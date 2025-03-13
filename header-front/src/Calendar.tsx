import { createMemo, createSignal, For, onCleanup, Show, useContext, type Component } from 'solid-js';
import { eachDayOfInterval, eachWeekOfInterval, endOfDay, endOfMonth, endOfWeek, Interval, isSameDay, isWithinInterval, setMonth, startOfDay, startOfMonth } from "date-fns";
import { GlobalStore } from './App';
import { RangeAvailability } from './spacetime_bindings';

type Level = {
  name: string,
  color: string,
  selectionColor: string,
  id: number
};
const LEVELS: Level[] = [
  {
    name: "Non spécifié",
    color: '#e5e7eb',
    selectionColor: '#cfd1d6',
    id: -1,
  },
  {
    name: "PAS disponible",
    color: '#f0a5a5',
    selectionColor: '#f07575',
    id: 0,
  },
  {
    name: "Arrangeable",
    color: '#f0d6a5',
    selectionColor: '#f0c085',
    id: 1,
  },
  {
    name: "Normalement Disponible",
    color: '#a5f0aa',
    selectionColor: '#5bf072',
    id: 2,
  },
];

const DEFAULT_LEVEL: Level = LEVELS[0];
const LEVEL_BY_ID: Record<number, Level> = Object.fromEntries(LEVELS.map(l => [l.id, l] as const));

const Calendar: Component = () => {
  const store = useContext(GlobalStore);
  if (!store)
    return <></>;

  const controller = new AbortController();
  onCleanup(() => {
    controller.abort();
  });

  const base_date = new Date(2025, 1, 1, 1);
  const months: number[] = [6, 7, 8];
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
  const [isPanelVisible, setIsPanelVisible] = createSignal(false);
  const [isAddingRangeLabel, setIsAddingRangeLabel] = createSignal(false);
  const [rangeLabelMessage, setRangeLabelMessage] = createSignal("");
  const [rangeLabelColor, setRangeLabelColor] = createSignal("#FF5733");

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

    if (isAddingRangeLabel()) {
      const r = parseInt(rangeLabelColor().substring(1, 3), 16);
      const g = parseInt(rangeLabelColor().substring(3, 5), 16);
      const b = parseInt(rangeLabelColor().substring(5, 7), 16);
      
      store.connection.reducers.createRangeLabel(
        rangeLabelMessage(),
        r, g, b,
        start.toISOString(),
        end.toISOString()
      );
      
      setIsAddingRangeLabel(false);
      setRangeLabelMessage("");
    } else {
      store.connection.reducers.createAvailabilityRange(start.toISOString(), end.toISOString(), availabilityLevel());
    }
    setCurrentSelection(null);
  };

  const forgetSelection = () => {
    setIsSelecting(false);
    setCurrentSelection(null);
  };

  window.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.code === "Escape") {
      forgetSelection();
      setIsAddingRangeLabel(false);
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
    <div class={`gap-5 pb-5 flex flex-row justify-end items-start ${isPanelVisible() ? "overflow-hidden lg:overflow-visible h-screen lg:h-auto" : ""}`}>

      <div class={`
        flex-grow p-5 flex flex-col gap-5
        z-10 bg-white
        w-full h-full
        lg:h-auto lg:max-w-md

        absolute inset
        lg:sticky lg:top-5 lg:z-99

        ${isPanelVisible() ? "" : "hidden lg:flex"}
      `}>
        <div class="flex flex-col gap-2">
          <div class="flex flex-row flex-wrap-reverse gap-2">
            <span class="text-gray-600">
              Connected as </span>{store.users[store.user_id ?? 0]?.username}
              <div
                class="flex justify-center items-center cursor-pointer"
                onClick={() => {
                  const nu = prompt("New username ?");
                  if (!nu)
                    return;
                  store.connection.reducers.rename(nu);
                }}
              >
                <svg width="14px" height="14px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.4998 5.50067L18.3282 8.3291M13 21H21M3 21.0004L3.04745 20.6683C3.21536 19.4929 3.29932 18.9052 3.49029 18.3565C3.65975 17.8697 3.89124 17.4067 4.17906 16.979C4.50341 16.497 4.92319 16.0772 5.76274 15.2377L17.4107 3.58969C18.1918 2.80865 19.4581 2.80864 20.2392 3.58969C21.0202 4.37074 21.0202 5.63707 20.2392 6.41812L8.37744 18.2798C7.61579 19.0415 7.23497 19.4223 6.8012 19.7252C6.41618 19.994 6.00093 20.2167 5.56398 20.3887C5.07171 20.5824 4.54375 20.6889 3.48793 20.902L3 21.0004Z" stroke="#777" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            <span class="flex-grow" />
            <button
              class="px-2 bg-blue-400 hover:bg-blue-500 cursor-pointer rounded lg:hidden"
              onClick={() => setIsPanelVisible(false)}
            >
              Hide
            </button>
          </div>
          <div class={`flex flex-row gap-2 flex-wrap`}>
            <button
              class={`bg-orange-300 px-1 rounded cursor-pointer`}
              onClick={() => {
                store.connection.reducers.diconnectFromClient();
              }}
            >
              Sign out
            </button>
            <button
              class={`bg-red-400 px-1 rounded cursor-pointer`}
              onClick={() => {
                if (confirm("ARE YOU SURE YOU WANT DO COMPLETELY DELETE YOUR PROFILE?"))
                  store.connection.reducers.deleteUser(store.user_id ?? 0);
              }}
            >
              DELETE ACCOUNT
            </button>
          </div>
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
              <h3 class="font-bold">Availability level brush.</h3>
              <div class="text-gray-800 mb-3">Select a days on the calendar to change them.</div>
              <div class="flex flex-col gap-3">
                <For
                  each={LEVELS}
                  children={level => <div 
                    class={`p-3 rounded cursor-pointer ${availabilityLevel() === level.id ? 'ring-2 ring-blue-500' : ''}`}
                    style={{ background: level.color }}
                    onClick={() => setAvailabilityLevel(level.id)}
                  >
                    {level.name}
                  </div>}
                />

                <div class="border-t border-gray-300 my-2 pt-3">
                  <button
                    class="w-full p-3 bg-indigo-100 rounded text-indigo-800 hover:bg-indigo-200 cursor-pointer"
                    onClick={() => setIsAddingRangeLabel(true)}
                  >
                    + Add Range Label
                  </button>
                </div>
                
                <Show when={isAddingRangeLabel()}>
                  <div class="p-3 bg-indigo-50 rounded">
                    <h3 class="font-bold mb-2">Create Range Label</h3>
                    <div class="flex flex-col gap-3">
                      <div>
                        <label class="block text-sm font-medium mb-1">Message</label>
                        <input
                          type="text"
                          value={rangeLabelMessage()}
                          onInput={(e) => setRangeLabelMessage(e.target.value)}
                          class="w-full p-2 border rounded"
                          placeholder="Enter label message"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium mb-1">Color</label>
                        <input
                          type="color"
                          value={rangeLabelColor()}
                          onInput={(e) => setRangeLabelColor(e.target.value)}
                          class="w-full h-10"
                        />
                      </div>
                      <div class="text-sm text-gray-600 mt-1">
                        Select days on the calendar to apply this label
                      </div>
                      <div class="flex justify-between mt-2">
                        <button
                          class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer"
                          onClick={() => setIsAddingRangeLabel(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={tab() === "global"}>
            <div class="flex flex-col gap-3">
              <Show when={hoveredDay() !== null}>
                <div class="p-3 bg-gray-100 rounded">
                  <h3 class="font-bold mb-2">Availabilities for {hoveredDay()?.toLocaleDateString()}</h3>
                  <div class="flex flex-col gap-2">
                    <For
                      each={
                        Object.values(store.range_availability)
                          .filter(p => p != null)
                          .filter(p => hoveredDay() !== null && isWithinInterval(hoveredDay()!, { start: p.rangeStart, end: p.rangeEnd }))
                          .filter(range => range.availabilityLevel !== -1)
                          .sort((a, b) => b.availabilityLevel - a.availabilityLevel)
                      }
                      children={range => (
                        <div class="flex items-center gap-2">
                          <div class="w-4 h-4 rounded" 
                               style={{ 
                                 background: LEVEL_BY_ID[range.availabilityLevel].color,
                               }}></div>
                          <span>{store.users[range.creatorUserId]?.username || 'Unknown user'}</span>
                          <span class="text-gray-500 text-sm">
                            ({LEVEL_BY_ID[range.availabilityLevel].name})
                          </span>
                        </div>
                      )}
                    />
                  </div>
                  
                  <Show when={Object.values(store.range_labels)
                    .filter(p => p != null)
                    .filter(p => hoveredDay() !== null && isWithinInterval(hoveredDay()!, { start: new Date(p.rangeStart), end: new Date(p.rangeEnd) }))
                    .length > 0}
                  >
                    <h3 class="font-bold mb-2 mt-4">Labels for this day</h3>
                    <div class="flex flex-col gap-2">
                      <For each={Object.values(store.range_labels)
                        .filter(p => p != null)
                        .filter(p => hoveredDay() !== null && isWithinInterval(hoveredDay()!, { start: new Date(p.rangeStart), end: new Date(p.rangeEnd) }))}
                        children={label => (
                          <div class="flex items-center gap-2 p-1 hover:bg-gray-200 rounded">
                            <div class="w-4 h-4 rounded-full" 
                                style={{ background: `rgb(${label.colorR}, ${label.colorG}, ${label.colorB})` }}></div>
                            <span class="flex-grow">{label.title}</span>
                            <span class="text-gray-500 text-sm">
                              ({store.users[label.creatorUserId]?.username || 'Unknown user'})
                            </span>
                            <Show when={store.user_id === label.creatorUserId}>
                              <button
                                class="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-300 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this label?")) {
                                    store.connection.reducers.deleteRangeLabel(label.id);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </Show>
                          </div>
                        )}
                      />
                    </div>
                  </Show>
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
                  
                  <Show when={Object.values(store.range_labels).length > 0}>
                    <h3 class="font-bold mb-2 mt-4">Range Labels</h3>
                    <div class="flex flex-col gap-1">
                      <For each={Object.values(store.range_labels)}
                        children={label => label && (
                          <div class="p-2 flex items-center gap-2 rounded hover:bg-gray-200">
                            <div 
                              class="w-4 h-4 rounded-full" 
                              style={{ background: `rgb(${label.colorR}, ${label.colorG}, ${label.colorB})` }} 
                            />
                            <div class="flex-grow">{label.title}</div>
                            <Show when={store.user_id === label.creatorUserId}>
                              <button
                                class="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-300 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this label?")) {
                                    store.connection.reducers.deleteRangeLabel(label.id);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </Show>
                          </div>
                        )}
                      />
                    </div>
                  </Show>

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
      
      <div class={`gap-5 flex flex-col p-5`}>
        <div
          class={`flex flex-row sticky top-5 right-5 z-99 ${isPanelVisible() ? "hidden" : ""}`}
        >
          <div class="flex-grow" />
          <button
            class="
              px-3 py-1 bg-blue-400 hover:bg-blue-500
              cursor-pointer rounded lg:hidden
              shadow
            "
            onClick={() => setIsPanelVisible(true)}
          >
            Menu
          </button>
        </div>

        <For each={months.map(mi => setMonth(base_date, mi))} children={month => {
          const monthInterval = { start: startOfMonth(month), end: endOfMonth(month) };
          {/* Month */}
          return <div class="flex flex-1 flex-col gap-3">
            <h2 class="capitalize text-xl">{intl.format(month)}</h2>
            <div class={`gap-1 lg:gap-3 flex flex-col`}>
              {/* Week */}
              <For
                each={eachWeekOfInterval(monthInterval, { weekStartsOn: 1 })}
                children={week => (<div class={`gap-1 lg:gap-3 flex flex-row`}>
                  <For
                    each={eachDayOfInterval({ start: week, end: endOfWeek(week, { weekStartsOn: 1 }) })}
                    children={day => {
                      const is_selected = () => currentSelection() && isWithinInterval(day, currentSelection()!) || hoveredDay() === day;
                      const myRanges = createMemo<RangeAvailability[]>(() => (
                        Object.values(store.range_availability)
                          .filter(p => p != null)
                          .filter(p => isWithinInterval(day, { start: p.rangeStart, end: p.rangeEnd }))
                      ));
                      
                      const dayRangeLabels = createMemo(() => (
                        Object.values(store.range_labels)
                          .filter(p => p != null)
                          .filter(p => isWithinInterval(day, { start: new Date(p.rangeStart), end: new Date(p.rangeEnd) }))
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
                      const personalLevel = createMemo<number>(() => (
                        myRanges().find(p => p.creatorUserId === store.user_id)?.availabilityLevel ?? DEFAULT_LEVEL.id
                      ));

                      const renderTargetLevel = () => tab() === "personal" ? personalLevel() : bestLevel();
                      
                      // Calculate proportions for global view
                      const getBackgroundStyle = (): { background: string } => {
                        if (tab() === "personal") {
                          return {
                            background: LEVEL_BY_ID[renderTargetLevel()].color,
                          };
                        } else {
                          // When focusing on a specific user, show only their availability
                          if (focusedUserId() !== null || lockedUserId() !== null) {
                            const targetUserId = lockedUserId() !== null ? lockedUserId() : focusedUserId();
                            const userRange = myRanges().find(range => range.creatorUserId === targetUserId);
                            if (userRange) {
                              return {
                                background: LEVEL_BY_ID[userRange.availabilityLevel].color,
                              };
                            }
                            return { background: DEFAULT_LEVEL.color };
                          }
                          
                          // Regular aggregate view with proportional coloring
                          const total = packs()[0] + packs()[1] + packs()[2];
                          if (total === 0) return { background: DEFAULT_LEVEL.color };
                          
                          const prop0 = (packs()[0] / total) * 100;
                          const prop1 = (packs()[1] / total) * 100;
                          // const prop2 = (packs()[2] / total) * 100;
                          
                          const c0 = LEVEL_BY_ID[0].color;
                          const c1 = LEVEL_BY_ID[1].color;
                          const c2 = LEVEL_BY_ID[2].color;
                          
                          return {
                            background: `linear-gradient(to right, 
                              ${c0} 0%, ${c0} ${prop0}%, 
                              ${c1} ${prop0}%, ${c1} ${prop0 + prop1}%, 
                              ${c2} ${prop0 + prop1}%, ${c2} 100%)`
                          };
                        }
                      };

                      const renderRangeLabels = () => {
                        const labels = dayRangeLabels();
                        if (labels.length === 0) return null;
                        
                        return (
                          <div class="absolute top-0 left-0 right-0 flex flex-col w-full overflow-hidden">
                            {labels.map((label, index) => (
                              <div 
                                class={`h-1.5 w-full range-label-line cursor-pointer ${index === 0 ? 'rounded-t-md' : ''}`}
                                style={{ 
                                  background: `rgb(${label.colorR}, ${label.colorG}, ${label.colorB})`,
                                  "margin-top": index > 0 ? '1px' : '0',
                                }}
                                title={label.title}
                              />
                            ))}
                          </div>
                        );
                      };
                      
                      return (
                        <div 
                          class={`
                            relative inline-block w-10 h-10 lg:w-25 lg:h-25 p-1 lg:p-2 rounded
                            bg-gray-200 overflow-hidden
                            select-none text-sm lg:text-base
                            ${is_selected() ? `outline-solid outline-yellow-500` : ``}
                            ${isWithinInterval(day, monthInterval) ? "opacity-100" : "opacity-25"}
                          `}
                          style={{
                            ...getBackgroundStyle(),
                            "outline-color": tab() === "personal" ? (
                              // isAddingRangeLabel() ? rangeLabelColor() : ["red", "#FFD400", "#00A800"][availabilityLevel()]
                              isAddingRangeLabel() ? rangeLabelColor() : LEVEL_BY_ID[availabilityLevel()].selectionColor
                            ) : undefined,
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
                          data-level={personalLevel() ?? "null"}
                          data-tata={JSON.stringify(packs())}
                        >
                          <span>
                            {day.getDate()}
                          </span>
                          {renderRangeLabels()}
                        </div>
                      );
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
