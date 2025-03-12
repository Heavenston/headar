import { createSignal, For, onCleanup, type Component } from 'solid-js';
import { eachDayOfInterval, eachWeekOfInterval, endOfMonth, endOfWeek, Interval, isSameDay, isWithinInterval, setMonth, startOfMonth } from "date-fns";

const App: Component = () => {
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

  function commitSelection() {
    setIsSelecting(false);
  }

  function forgetSelection() {
    setIsSelecting(false);
    setCurrentSelection(null);
  }

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
    <div>
      <div class={`min-h-screen gap-10 flex flex-col items-center py-10`}>
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

                      return <span
                        class={`
                          inline-block w-25 h-25 p-2 rounded
                          bg-gray-200
                          select-none
                          ${is_selected() ? `bg-yellow-500` : ``}
                          ${isWithinInterval(day, monthInterval) ? "opacity-100" : "opacity-25"}
                        `}
                        onMouseDown={e => {
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
      <div>
      </div>
    </div>
  );
};

export default App;
