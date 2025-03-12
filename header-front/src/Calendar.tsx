import { createComputed, createMemo, createSignal, For, onCleanup, Show, useContext, type Component } from 'solid-js';
import { eachDayOfInterval, eachWeekOfInterval, endOfDay, endOfMonth, endOfWeek, Interval, isSameDay, isWithinInterval, setMonth, startOfDay, startOfMonth } from "date-fns";
import { GlobalStore } from './App';
import { RangeAvailability } from './spacetime_bindings';

// Availability level colors
const COLOR_UNAVAILABLE = '#f0a5a5';
const COLOR_ARRANGEABLE = '#f0d6a5';
const COLOR_AVAILABLE = '#a5f0aa';
const COLOR_NO_DATA = '#e5e7eb';

const Calendar: Component = () => {
  const store = useContext(GlobalStore);
  if (!store)
    return <></>;

  const controller = new AbortController();
  onCleanup(() => {
    controller.abort();
  });

  const base_date = new Date(2025, 1, 1, 1);
  const months = [5, 6, 7, 8];
  const intl = Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    month: "long",
  });

  const [currentSelection, setCurrentSelection] = createSignal<Interval | null>(null);
  const [isSelecting, setIsSelecting] = createSignal(false);
  const [availabilityLevel, setAvailabilityLevel] = createSignal(0);
  const [tab, setTab] = createSignal<"global" | "personal">("personal");
  const [hoveredDay, setHoveredDay] = createSignal<Date | null>(null);
  const [focusedUserId, setFocusedUserId] = createSignal<number | null>(null);
  const [lockedUserId, setLockedUserId] = createSignal<number | null>(null);
  const [isPanelVisible, setIsPanelVisible] = createSignal(true);

  const commitSelection = () => {
    setIsSelecting(false);
    const range = currentSelection();
    if (!range)
      return;

    let start = new Date(range.start);
    let end = new Date(range.end);
    if (start.getTime() > end.getTime())
      [end, start] = [start, end];
    start = startOfDay(start);
    end = endOfDay(end);

    store.connection.reducers.createAvailabilityRange(start.toISOString(), end.toISOString(), availabilityLevel());
    setCurrentSelection(null);
  };

  const forgetSelection = () => {
    setIsSelecting(false);
    setCurrentSelection(null);
  };

  window.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.code === "Escape") {
      forgetSelection();
      ev.preventDefault();
    }
  }, { signal: controller.signal });
  window.addEventListener("mousedown", (me: MouseEvent) => {
    if (isSelecting()) {
      forgetSelection();
      me.preventDefault();
    }
  }, { signal: controller.signal });

  return (
    <div class={`h-screen gap-5 flex flex-row justify-center relative`}>
      <div class={`
        flex-grow p-5 flex flex-col gap-5 md:max-w-md
        md:relative absolute z-10 bg-white
        w-full ${isPanelVisible() ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
        transition duration-300 ease-in-out
        md:translate-x-0 md:w-auto md:overflow-visible
      `}>
        <div>
          <span class="text-gray-600">Connected as </span>{store.users[store.user_id ?? 0]?.username}
          {" "}<button
            class={`bg-orange-300 px-1 rounded cursor-pointer`}
            onClick={() => {
              store.connection.reducers.diconnectFromClient();
            }}
          >
            Sign out
          </button>
          {" "}<button
            class={`bg-red-400 px-1 rounded cursor-pointer`}
            onClick={() => {
              if (confirm("ARE YOU SURE YOU WANT DO COMPLETELY DELETE YOUR PROFILE?"))
                store.connection.reducers.deleteUser(store.user_id ?? 0);
            }}
          >
            DELETE ACCOUNT
          </button>
        </div>
        
        <div class={`flex flex-col gap-3`}>
          <div class="flex w-full">
            <button
              class={`
                flex-grow px-4 py-2 font-medium
                ${tab() === "personal" ? "border-b-2 border-blue-500" : "border-b-2 border-gray-300"}
                cursor-pointer
              `}
              onClick={() => setTab("personal")}
            >
              Edit (personal) Calendar
            </button>
            <button
              class={`
                flex-grow px-4 py-2 font-medium
                ${tab() === "global" ? "border-b-2 border-blue-500" : "border-b-2 border-gray-300"}
                cursor-pointer
              `}
              onClick={() => setTab("global")}
            >
              Aggregate Calendar
            </button>
          </div>

          <Show when={tab() === "personal"}>
            <div class="">
              <h3 class="font-bold mb-3">Pinceau de niveau de disponibilité</h3>
              <div class="flex flex-col gap-3">
                <div 
                  class={`p-3 rounded cursor-pointer ${availabilityLevel() === 0 ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ background: COLOR_UNAVAILABLE }}
                  onClick={() => setAvailabilityLevel(0)}
                >
                  PAS disponible
                </div>
                <div 
                  class={`p-3 rounded cursor-pointer ${availabilityLevel() === 1 ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ background: COLOR_ARRANGEABLE }}
                  onClick={() => setAvailabilityLevel(1)}
                >
                  Arrangeable
                </div>
                <div 
                  class={`p-3 rounded cursor-pointer ${availabilityLevel() === 2 ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ background: COLOR_AVAILABLE }}
                  onClick={() => setAvailabilityLevel(2)}
                >
                  Devrait être disponible
                </div>
              </div>
            </div>
          </Show>

          <Show when={tab() === "global"}>
            <div class="flex flex-col gap-3">
              <Show when={hoveredDay() !== null}>
                <div class="p-3 bg-gray-100 rounded">
                  <h3 class="font-bold mb-2">Availabilities for {hoveredDay()?.toLocaleDateString()}</h3>
                  <div class="flex flex-col gap-2">
                    <For each={Object.values(store.range_availability)
                      .filter(p => p != null)
                      .filter(p => hoveredDay() !== null && isWithinInterval(hoveredDay()!, { start: p.rangeStart, end: p.rangeEnd }))
                      .sort((a, b) => b.availabilityLevel - a.availabilityLevel)}
                      children={range => (
                        <div class="flex items-center gap-2">
                          <div class="w-4 h-4 rounded" 
                               style={{ 
                                 background: range.availabilityLevel === 0 ? COLOR_UNAVAILABLE : 
                                             range.availabilityLevel === 1 ? COLOR_ARRANGEABLE : COLOR_AVAILABLE
                               }}></div>
                          <span>{store.users[range.creatorUserId]?.username || 'Unknown user'}</span>
                          <span class="text-gray-500 text-sm">
                            {range.availabilityLevel === 0 ? '(Not available)' : 
                             range.availabilityLevel === 1 ? '(Arrangeable)' : '(Available)'}
                          </span>
                        </div>
                      )}
                    />
                  </div>
                </div>
              </Show>
              
              <Show when={hoveredDay() === null}>
                <div class="p-3 bg-gray-100 rounded">
                  <h3 class="font-bold mb-2">All Users</h3>
                  <div class="flex flex-col gap-1">
                    <For each={Object.values(store.users)}
                      children={user => user && (
                        <div 
                          class={`p-2 rounded cursor-pointer ${
                            (focusedUserId() === user.id || lockedUserId() === user.id) ? 
                              'bg-blue-200' : 'hover:bg-gray-200'
                          }`}
                          onMouseEnter={() => { 
                            if (lockedUserId() === null) setFocusedUserId(user.id) 
                          }}
                          onMouseLeave={() => { 
                            if (lockedUserId() === null) setFocusedUserId(null) 
                          }}
                          onClick={() => {
                            setLockedUserId(prev => prev === user.id ? null : user.id);
                            setFocusedUserId(lockedUserId());
                          }}
                        >
                          {user.username}
                        </div>
                      )}
                    />
                  </div>

                  <Show when={lockedUserId() !== null}>
                    <div class="mt-3 p-2 bg-blue-100 rounded flex justify-between items-center">
                      <span>Currently showing {store.users[lockedUserId() || 0]?.username}'s calendar</span>
                      <button 
                        class="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                        onClick={() => {
                          setLockedUserId(null);
                          setFocusedUserId(null);
                        }}
                      >
                        Return to aggregate view
                      </button>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <button
        class="md:hidden fixed top-2 right-2 z-20 bg-blue-500 text-white p-2 rounded shadow-md"
        onClick={() => setIsPanelVisible(!isPanelVisible())}
      >
        {isPanelVisible() ? '← Back to Calendar' : '→ Options'}
      </button>
      
      <div class={`
        min-h-screen overflow-auto gap-5 flex flex-col p-5 
        md:ml-0 ml-2
        ${isPanelVisible() ? 'md:block hidden' : 'block'}
      `}>
        <For each={months.map(mi => setMonth(base_date, mi))} children={month => {
          const monthInterval = { start: startOfMonth(month), end: endOfMonth(month) };
          {/* Month */}
          return <div class="flex flex-col gap-3">
            <h2 class="capitalize text-xl">{intl.format(month)}</h2>
            <div class={`gap-1 md:gap-3 flex flex-col`}>
              {/* Week */}
              <For
                each={eachWeekOfInterval(monthInterval, { weekStartsOn: 1 })}
                children={week => (<div class={`gap-1 md:gap-3 flex flex-row`}>
                  <For
                    each={eachDayOfInterval({ start: week, end: endOfWeek(week, { weekStartsOn: 1 }) })}
                    children={day => {
                      const is_selected = () => currentSelection() && isWithinInterval(day, currentSelection()!) || hoveredDay() === day;
                      const myRanges = createMemo<RangeAvailability[]>(() => (
                        Object.values(store.range_availability)
                          .filter(p => p != null)
                          .filter(p => isWithinInterval(day, { start: p.rangeStart, end: p.rangeEnd }))
                      ));
                      const packs = createMemo<[number, number, number]>(() => {
                        // In global view, account for all users (including those with no data)
                        if (tab() === "global" && focusedUserId() === null && lockedUserId() === null) {
                          return myRanges().reduce((curr, ava) => {
                            curr[ava.availabilityLevel]++;
                            return curr;
                          }, [0, 0, 0] as [number, number, number]);
                        } else {
                          // For personal or focused user view, just count exact ranges
                          return myRanges().reduce((curr, ava) => {
                            if (tab() === "personal" || 
                                (focusedUserId() !== null && ava.creatorUserId === focusedUserId()) ||
                                (lockedUserId() !== null && ava.creatorUserId === lockedUserId())) {
                              curr[ava.availabilityLevel]++;
                            }
                            return curr;
                          }, [0, 0, 0] as [number, number, number]);
                        }
                      });
                      const bestLevel = () => packs().reduce((best, _current, current, arr) => arr[current] > arr[best] ? current : best);
                      const personalLevel = createMemo<number | null>(() => (
                        myRanges().find(p => p.creatorUserId === store.user_id)?.availabilityLevel ?? null
                      ));

                      const renderTargetLevel = () => tab() === "personal" ? personalLevel() : bestLevel();
                      
                      // Calculate proportions for global view
                      const getBackgroundStyle = (): { background: string } => {
                        if (tab() === "personal") {
                          return {
                            background: renderTargetLevel() === 0 ? COLOR_UNAVAILABLE : 
                                        renderTargetLevel() === 1 ? COLOR_ARRANGEABLE : 
                                        renderTargetLevel() === 2 ? COLOR_AVAILABLE :
                                                                    COLOR_NO_DATA
                          };
                        } else {
                          // When focusing on a specific user, show only their availability
                          if (focusedUserId() !== null || lockedUserId() !== null) {
                            const targetUserId = lockedUserId() !== null ? lockedUserId() : focusedUserId();
                            const userRange = myRanges().find(range => range.creatorUserId === targetUserId);
                            if (userRange) {
                              return {
                                background: userRange.availabilityLevel === 0 ? COLOR_UNAVAILABLE : 
                                            userRange.availabilityLevel === 1 ? COLOR_ARRANGEABLE : COLOR_AVAILABLE
                              };
                            }
                            return { background: COLOR_NO_DATA }; // for no data
                          }
                          
                          // Regular aggregate view with proportional coloring
                          const total = packs()[0] + packs()[1] + packs()[2];
                          if (total === 0) return { background: COLOR_NO_DATA };
                          
                          const prop0 = (packs()[0] / total) * 100;
                          const prop1 = (packs()[1] / total) * 100;
                          // const prop2 = (packs()[2] / total) * 100;
                          
                          return {
                            background: `linear-gradient(to right, 
                              ${COLOR_UNAVAILABLE} 0%, ${COLOR_UNAVAILABLE} ${prop0}%, 
                              ${COLOR_ARRANGEABLE} ${prop0}%, ${COLOR_ARRANGEABLE} ${prop0 + prop1}%, 
                              ${COLOR_AVAILABLE} ${prop0 + prop1}%, ${COLOR_AVAILABLE} 100%)`
                          };
                        }
                      };

                      return <span
                        data-level={personalLevel() ?? "null"}
                        data-tata={JSON.stringify(packs())}
                        class={`
                          inline-block w-16 h-16 md:w-25 md:h-25 p-1 md:p-2 rounded
                          bg-gray-200
                          select-none text-sm md:text-base
                          ${is_selected() ? `outline-solid outline-yellow-500` : ``}
                          ${isWithinInterval(day, monthInterval) ? "opacity-100" : "opacity-25"}
                        `}
                        style={{
                          ...getBackgroundStyle(),
                          "outline-color": tab() === "personal" ? ["red", "#FFD400", "#00A800"][availabilityLevel()] : undefined,
                        }}
                        oncontextmenu={e => {
                          if (isSelecting()) {
                            e.preventDefault();
                            forgetSelection();
                          }
                        }}
                        onMouseDown={e => {
                          if (e.button == 2)
                            return;
                          if (tab() !== "personal")
                            return;
                          e.stopPropagation();
                          if (isSelecting()) {
                            setCurrentSelection({
                              start: currentSelection()?.start ?? day,
                              end: day,
                            });
                            setIsSelecting(false);
                            commitSelection();
                          }
                          else {
                            setCurrentSelection({
                              start: day,
                              end: day,
                            });
                            setIsSelecting(true);
                          }
                        }}
                        onMouseEnter={() => {
                          if (tab() === "global" && lockedUserId() === null) {
                            setHoveredDay(day);
                          }

                          if (tab() !== "personal")
                            return;
                          
                          if (!isSelecting())
                            return;
                          setCurrentSelection({
                            start: currentSelection()?.start ?? day,
                            end: day,
                          });
                        }}
                        onMouseLeave={() => {
                          if (tab() === "global") {
                            setHoveredDay(null);
                          }
                        }}
                        onMouseUp={() => {
                          if (!isSelecting())
                            return;
                          if (!currentSelection() || !isSameDay(day, currentSelection()?.start ?? day)) {
                            setIsSelecting(false);
                            commitSelection();
                          }
                        }}
                      >
                        <span>
                          {day.getDate()}
                        </span>
                      </span>;
                    }}
                  />
                </div>)}
              />
            </div>
          </div>;
        }} />
      </div>
    </div>
  );
};

export default Calendar;
