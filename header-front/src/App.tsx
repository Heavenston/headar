import { For, type Component } from 'solid-js';
import { eachDayOfInterval, eachWeekOfInterval, endOfMonth, endOfWeek, isWithinInterval, setMonth, startOfMonth } from "date-fns";

const App: Component = () => {
  const base_date = new Date(2025, 1, 1, 1);
  const months = [5, 6, 7, 8];
  const intl = Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    month: "long",
  });

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
                    children={day => <span class={`
                      inline-block w-25 h-25 p-2 rounded
                      bg-gray-200
                      select-none
                      ${isWithinInterval(day, monthInterval) ? "opacity-100" : "opacity-25"}
                    `}>
                      <span>
                        {day.getDate()}
                      </span>
                    </span>}
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
