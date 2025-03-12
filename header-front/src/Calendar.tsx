import { createComputed, createMemo, createSignal, For, onCleanup, Show, useContext, type Component } from 'solid-js';
import { eachDayOfInterval, eachWeekOfInterval, endOfDay, endOfMonth, endOfWeek, Interval, isSameDay, isWithinInterval, setMonth, startOfDay, startOfMonth } from "date-fns";
import { GlobalStore } from './App';
import { RangeAvailability } from './spacetime_bindings';

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
    <div class={`h-screen gap-5 flex flex-row justify-between`}>
      <div class={`flex-grow p-5 flex flex-col gap-5`}>
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
              Personal Calendar
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
                  style={{ background: '#f0a5a5' }}
                  onClick={() => setAvailabilityLevel(0)}
                >
                  PAS disponible
                </div>
                <div 
                  class={`p-3 rounded cursor-pointer ${availabilityLevel() === 1 ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ background: '#f0d6a5' }}
                  onClick={() => setAvailabilityLevel(1)}
                >
                  Arrangeable
                </div>
                <div 
                  class={`p-3 rounded cursor-pointer ${availabilityLevel() === 2 ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ background: '#a5f0aa' }}
                  onClick={() => setAvailabilityLevel(2)}
                >
                  Devrait être disponible
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
      <div class={`min-h-screen overflow-auto gap-10 flex flex-col p-10`}>
        <For each={months.map(mi => setMonth(base_date, mi))} children={month => {
          const monthInterval = { start: startOfMonth(month), end: endOfMonth(month) };
          {/* Month */}
          return <div class="flex flex-col gap-3">
            <h2 class="capitalize text-xl">{intl.format(month)}</h2>
            <div class={`gap-3 flex flex-col`}>
              {/* Week */}
              <For
                each={eachWeekOfInterval(monthInterval, { weekStartsOn: 1 })}
                children={week => (<div class={`gap-3 flex flex-row`}>
                  <For
                    each={eachDayOfInterval({ start: week, end: endOfWeek(week, { weekStartsOn: 1 }) })}
                    children={day => {
                      const is_selected = () => currentSelection() && isWithinInterval(day, currentSelection()!);
                      const myRanges = createMemo<RangeAvailability[]>(() => (
                        Object.values(store.range_availability)
                          .filter(p => p != null)
                          .filter(p => isWithinInterval(day, { start: p.rangeStart, end: p.rangeEnd }))
                      ));
                      const packs = createMemo<[number, number, number]>(() => (
                        myRanges().reduce((curr, ava) => {
                          curr[ava.availabilityLevel]++;
                          return curr;
                        }, [0, 0, 0] as [number, number, number])
                      ));
                      const bestLevel = () => packs().reduce((best, _current, current, arr) => arr[current] > arr[best] ? current : best);
                      const personalLevel = createMemo<number>(() => (
                        myRanges().find(p => p.creatorUserId === store.user_id)?.availabilityLevel ?? 0
                      ));

                      const renderTargetLevel = () => tab() === "personal" ? personalLevel() : bestLevel();

                      return <span
                        data-level={personalLevel()}
                        class={`
                          inline-block w-25 h-25 p-2 rounded
                          bg-gray-200
                          select-none
                          ${is_selected() ? `outline-solid outline-yellow-500` : ``}
                          ${isWithinInterval(day, monthInterval) ? "opacity-100" : "opacity-25"}
                        `}
                        style={{
                          background: renderTargetLevel() === 0 ? '#f0a5a5' : 
                                      renderTargetLevel() === 1 ? '#f0d6a5' : 
                                                     '#a5f0aa'
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
                          if (!isSelecting())
                            return;
                          setCurrentSelection({
                            start: currentSelection()?.start ?? day,
                            end: day,
                          });
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
