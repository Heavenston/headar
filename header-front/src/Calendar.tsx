import { createComputed, createMemo, createSignal, For, onCleanup, useContext, type Component } from 'solid-js';
import { eachDayOfInterval, eachWeekOfInterval, endOfDay, endOfMonth, endOfWeek, Interval, isSameDay, isWithinInterval, setMonth, startOfDay, startOfMonth } from "date-fns";
import { GlobalStore } from './App';

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

    setTimeout(() => {
      console.log([...store.connection.db.rangeAvailability.iter()]);
    }, 250);
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
    <div class={`h-screen gap-10 flex flex-row justify-between`}>
      <div class={`flex-grow p-10`}>
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
        
        <div class="mt-10">
          <h3 class="font-bold mb-3">Niveau de disponibilité</h3>
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
                      const level = createMemo<number>(() => {
                        for (const p of Object.values(store.range_availability)) {
                          if (p == null)
                            continue;
                          if (p.creatorUserId !== store.user_id)
                            continue;
                          if (isWithinInterval(day, { start: p.rangeStart, end: p.rangeEnd }))
                            return p.availabilityLevel;
                        }
                        return 0;
                      });

                      return <span
                        data-level={level()}
                        class={`
                          inline-block w-25 h-25 p-2 rounded
                          bg-gray-200
                          select-none
                          ${is_selected() ? `outline-solid outline-yellow-500` : ``}
                          ${isWithinInterval(day, monthInterval) ? "opacity-100" : "opacity-25"}
                        `}
                        style={{
                          background: level() === 0 ? '#f0a5a5' : 
                                      level() === 1 ? '#f0d6a5' : 
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
