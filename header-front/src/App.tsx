import { Component, createContext, Match, onCleanup, Switch } from "solid-js";
import { createStore } from "solid-js/store";
import { DbConnection, RangeAvailability, RangeLabel, User } from "./spacetime_bindings"
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import Login from "./Login";
import Calendar from "./Calendar";

export type GlobalStore = {
  ready: boolean,
  connection: DbConnection,
  user_id: number | null,

  users: Partial<Record<number, User>>,
  range_labels: Partial<Record<number, RangeLabel>>,
  range_availability: Partial<Record<number, RangeAvailability>>,
};

export const GlobalStore = createContext<GlobalStore | null>(null);

const App: Component = () => {
  const [globalStore, setGlobalStore] = createStore<GlobalStore>({
    ready: false,
    connection: DbConnection.builder()
      .withUri("wss://spacetimedb-nautilus.heav.fr")
      .withModuleName("headar")
      .withToken(localStorage.getItem("token") ?? undefined)
      .onConnect(on_connect)
      .onDisconnect(on_disconnect)
      .onConnectError(on_connect_error)
      .build(),

    user_id: null,
    users: {},
    range_labels: {},
    range_availability: {},
  });

  function on_connect(conn: DbConnection, identity: Identity, token: string) {
    console.log("Connected!");
    localStorage.setItem("token", token);

    conn.subscriptionBuilder()
      .onApplied(() => {setGlobalStore("ready", true);})
      .subscribeToAllTables();

    conn.db.userIdentity.onInsert((_ctx, row) => {
      if (!row.identity.isEqual(identity))
        return;
      setGlobalStore("user_id", row.userId === 0 ? null : row.userId);
    });
    conn.db.userIdentity.onUpdate((_ctx, brow, nrow) => {
      if (!brow.identity.isEqual(identity))
        return;
      setGlobalStore("user_id", nrow.userId === 0 ? null : nrow.userId);
    });

    conn.db.user.onInsert((_ctx, user) => {
      setGlobalStore("users", user.id, user);
    });
    conn.db.user.onUpdate((_ctx, brow, nrow) => {
      setGlobalStore("users", brow.id, nrow);
    });
    conn.db.user.onDelete((_ctx, deleted) => {
      setGlobalStore("users", deleted.id, undefined);
    });

    conn.db.rangeLabels.onInsert((_ctx, added) => {
      setGlobalStore("range_labels", added.id, added);
    });
    conn.db.rangeLabels.onUpdate((_ctx, brow, nrow) => {
      setGlobalStore("range_labels", brow.id, nrow);
    });
    conn.db.rangeLabels.onDelete((_ctx, deleted) => {
      setGlobalStore("range_labels", deleted.id, undefined);
    });

    conn.db.rangeAvailability.onInsert((_ctx, added) => {
      setGlobalStore("range_availability", added.id, added);
    });
    conn.db.rangeAvailability.onUpdate((_ctx, brow, nrow) => {
      setGlobalStore("range_availability", brow.id, nrow);
    });
    conn.db.rangeAvailability.onDelete((_ctx, deleted) => {
      setGlobalStore("range_availability", deleted.id, undefined);
    });
  }

  function on_disconnect() {
    console.log("Disconnected!");
  }

  function on_connect_error() {
    console.log("Could not connect");
  }

  onCleanup(() => {
    globalStore.connection.disconnect();
  });

  return <GlobalStore.Provider value={globalStore}>
    <Switch>
      <Match when={globalStore.user_id === null}>
        <Login />
      </Match>
      <Match when={globalStore.user_id !== null}>
        <Calendar />
      </Match>
    </Switch>
  </GlobalStore.Provider>;
};

export default App;
