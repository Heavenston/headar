use log::warn;
use spacetimedb::{Identity, ReducerContext, Table};
use time::{format_description::well_known::Rfc3339, Duration};

#[spacetimedb::table(name = user_identity, index(name = online_and_userid, btree(columns = [online, user_id])), public)]
pub struct UserIdentity {
    #[primary_key]
    pub identity: Identity,
    #[index(btree)]
    pub user_id: u32,
    pub online: bool,
}

#[spacetimedb::table(name = user, public)]
pub struct User {
    #[primary_key]
    #[auto_inc]
    pub id: u32,
    pub username: String,
    pub online: bool,
}

#[spacetimedb::table(name = range_labels, public)]
pub struct RangeLabel {
    #[primary_key]
    #[auto_inc]
    pub id: u32,
    #[index(btree)]
    pub creator_user_id: u32,
    pub color_r: u8,
    pub color_g: u8,
    pub color_b: u8,
    pub title: String,
    #[index(btree)]
    pub range_start: String,
    #[index(btree)]
    pub range_end: String,
}

#[spacetimedb::table(name = range_availability, public)]
pub struct RangeAvailability {
    #[primary_key]
    #[auto_inc]
    pub id: u32,
    #[index(btree)]
    pub creator_user_id: u32,
    pub availability_level: i8,
    pub range_start: String,
    pub range_end: String,
}

#[spacetimedb::reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext) {
    if let Some(identity) = ctx.db.user_identity().identity().find(ctx.sender) {
        let identity = ctx.db.user_identity().identity().update(UserIdentity {
            online: true,
            ..identity
        });

        if identity.user_id != 0 {
            let Some(user) = ctx.db.user().id().find(identity.user_id)
            else {
                warn!("User not found: {}", identity.user_id);
                return;
            };

            if !user.online {
                ctx.db.user().id().update(User {
                    online: true,
                    ..user
                });
            }
        }
    }
    else {
        ctx.db.user_identity().insert(UserIdentity {
            identity: ctx.sender,
            user_id: 0,
            online: true,
        });
    }
}

#[spacetimedb::reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    let Some(user_identity) = ctx.db.user_identity().identity().find(ctx.sender)
    else {
        warn!("Sender ({}) has no user identity", ctx.sender);
        return;
    };

    if user_identity.user_id != 0 {
        let Some(user) = ctx.db.user().id().find(user_identity.user_id)
        else {
            warn!("Could not find user {}", user_identity.user_id);
            return;
        };

        let count = ctx.db.user_identity()
            .online_and_userid()
            .filter((true, user.id))
            .count();

        ctx.db.user().id().update(User {
            online: count > 0,
            ..user
        });
    }
}

#[spacetimedb::reducer]
pub fn create_user(ctx: &ReducerContext, username: String) {
    ctx.db.user().insert(User {
        id: 0,
        username,
        online: false,
    });
}

#[spacetimedb::reducer]
pub fn delete_user(ctx: &ReducerContext, user_id: u32) {
    ctx.db.user().id().delete(user_id);

    // Delete the user form all identities logged in with it
    
    for user_identity in ctx.db.user_identity().user_id().filter(user_id) {
        ctx.db.user_identity().identity().update(UserIdentity {
            user_id: 0,
            ..user_identity
        });
    }

    ctx.db.range_availability().creator_user_id().delete(user_id);
    ctx.db.range_labels().creator_user_id().delete(user_id);
}

#[spacetimedb::reducer]
pub fn diconnect_from_client(ctx: &ReducerContext) -> Result<(), String> {
    let Some(user_identity) = ctx.db.user_identity().identity().find(ctx.sender)
    else {
        warn!("Sender ({}) has no user identity", ctx.sender);
        return Ok(());
    };

    if user_identity.user_id == 0 {
        return Err("Already logged out".into());
    }

    ctx.db.user_identity().identity().update(UserIdentity {
        user_id: 0,
        ..user_identity
    });

    let Some(user) = ctx.db.user().id().find(user_identity.user_id)
    else {
        warn!("Could not find user {}", user_identity.user_id);
        return Ok(());
    };

    let count = ctx.db.user_identity()
        .online_and_userid()
        .filter((true, user.id))
        .count();

    ctx.db.user().id().update(User {
        online: count > 0,
        ..user
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn connect_to_client(ctx: &ReducerContext, id: u32) -> Result<(), String> {
    let Some(user_identity) = ctx.db.user_identity().identity().find(ctx.sender)
    else {
        warn!("Sender ({}) has no user identity", ctx.sender);
        return Ok(());
    };

    if user_identity.user_id != 0 {
        return Err("Not logged out, log out first".into());
    }

    let Some(user) = ctx.db.user().id().find(id)
    else {
        return Err("No player with that username".into());
    };

    ctx.db.user_identity().identity().update(UserIdentity {
        user_id: user.id,
        ..user_identity
    });

    if !user.online {
        ctx.db.user().id().update(User {
            online: true,
            ..user
        });
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn create_range_label(ctx: &ReducerContext, title: String, color_r: u8, color_g: u8, color_b: u8, range_start: String, range_end: String) -> Result<(), String> {
    let Some(user_identity) = ctx.db.user_identity().identity().find(ctx.sender)
    else {
        warn!("Sender ({}) has no user identity", ctx.sender);
        return Ok(());
    };

    if user_identity.user_id == 0 {
        return Err("Not signed in".into());
    }

    if time::OffsetDateTime::parse(&range_start, &Rfc3339).is_err() {
        return Err("Invalid start time".into());
    }

    if time::OffsetDateTime::parse(&range_end, &Rfc3339).is_err() {
        return Err("Invalid end time".into());
    }

    ctx.db.range_labels().insert(RangeLabel {
        id: 0,
        creator_user_id: user_identity.user_id,
        color_r,
        color_g,
        color_b,
        title,
        range_start,
        range_end,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_range_label(ctx: &ReducerContext, id: u32) -> Result<(), String> {
    let Some(user_identity) = ctx.db.user_identity().identity().find(ctx.sender)
    else {
        warn!("Sender ({}) has no user identity", ctx.sender);
        return Ok(());
    };

    if user_identity.user_id == 0 {
        return Err("Not signed in".into());
    }

    let Some(range_label) = ctx.db.range_labels().id().find(id)
    else { return Err("No such range label".into()); };

    if range_label.creator_user_id != user_identity.user_id {
        return Err("Not your creator id".into());
    }

    ctx.db.range_labels().id().delete(id);

    Ok(())
}

#[spacetimedb::reducer]
pub fn create_availability_range(ctx: &ReducerContext, range_start: String, range_end: String, availability_level: i8) -> Result<(), String> {
    let Some(user_identity) = ctx.db.user_identity().identity().find(ctx.sender)
    else {
        warn!("Sender ({}) has no user identity", ctx.sender);
        return Ok(());
    };

    if user_identity.user_id == 0 {
        return Err("Not signed in".into());
    }

    let Ok(start) = time::OffsetDateTime::parse(&range_start, &Rfc3339)
    else {
        return Err("Invalid start time".into());
    };
    assert!(start.offset().is_utc());
    let Ok(end) = time::OffsetDateTime::parse(&range_end, &Rfc3339)
    else {
        return Err("Invalid end time".into());
    };
    assert!(end.offset().is_utc());

    for other in ctx.db.range_availability().creator_user_id().filter(user_identity.user_id) {
        let Ok(other_start) = time::OffsetDateTime::parse(&other.range_start, &Rfc3339)
        else { continue };
        let Ok(other_end) = time::OffsetDateTime::parse(&other.range_end, &Rfc3339)
        else { continue; };

        // completely under
        if other_start < start && other_end < end {
            continue;
        }
        // completely above
        if other_start > start && other_end > end {
            continue;
        }

        // completely inside
        if other_start >= start && other_end <= end {
            ctx.db.range_availability().id().delete(other.id);
            continue;
        }

        // completely around
        if other_start < start && other_end > end {
            // split in two
            ctx.db.range_availability().id().update(RangeAvailability {
                id: other.id,
                creator_user_id: other.creator_user_id,
                availability_level: other.availability_level,
                range_start: other.range_start,
                range_end: (start - Duration::NANOSECOND).format(&Rfc3339).unwrap(),
            });
            ctx.db.range_availability().insert(RangeAvailability {
                id: 0,
                creator_user_id: other.creator_user_id,
                availability_level: other.availability_level,
                range_start: (end + Duration::NANOSECOND).format(&Rfc3339).unwrap(),
                range_end: other.range_end,
            });
            continue;
        }

        if other_start < start && other_end <= end {
            ctx.db.range_availability().id().update(RangeAvailability {
                range_end: (end - Duration::NANOSECOND).format(&Rfc3339).unwrap(),
                ..other
            });
            continue;
        }

        if other_start <= end && other_end > end {
            ctx.db.range_availability().id().update(RangeAvailability {
                range_start: (end + Duration::NANOSECOND).format(&Rfc3339).unwrap(),
                ..other
            });
            continue;
        }
    }

    // Level zero is not stored, it is the default
    if availability_level == 0 {
        return Ok(());
    }

    ctx.db.range_availability().insert(RangeAvailability {
        id: 0,
        creator_user_id: user_identity.user_id,
        availability_level,
        range_start,
        range_end
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_availability_range(ctx: &ReducerContext, id: u32) -> Result<(), String> {
    let Some(user_identity) = ctx.db.user_identity().identity().find(ctx.sender)
    else {
        warn!("Sender ({}) has no user identity", ctx.sender);
        return Ok(());
    };

    if user_identity.user_id == 0 {
        return Err("Not signed in".into());
    }

    let Some(range_availability) = ctx.db.range_availability().id().find(id)
    else { return Err("No such range availability".into()); };

    if range_availability.creator_user_id != user_identity.user_id {
        return Err("Not your creator id".into());
    }

    ctx.db.range_availability().id().delete(id);

    Ok(())
}
