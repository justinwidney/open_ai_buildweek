import { useCallback, useEffect, useRef, useState } from "react";
import { PlannerHeading } from "./PlannerFrame";
import {
  ACTIVITIES,
  DAYS_PER_WEEK,
  DAY_LABELS,
  HOURS_PER_DAY,
  WEEK_CELLS,
  cellDay,
  cellHour,
  cellIndex,
  hourLabel,
  readableHour,
  tallyWeek,
  type ActivityKey,
  type WeekCell,
  type WeekGrid,
} from "./plannerModel";

interface TimetableStepProps {
  grid: WeekGrid;
  onGridChange: (grid: WeekCell[]) => void;
  transitLabel: string;
}

type Brush = ActivityKey | "erase";

const CELL_NAMES: Record<string, string> = {
  sleep: "Sleep",
  work: "Work",
  study: "Class and study",
  friends: "Friends and family",
  fitness: "Health and fitness",
  transit: "Commute",
};

export function TimetableStep({ grid, onGridChange, transitLabel }: TimetableStepProps) {
  const [brush, setBrush] = useState<Brush>("sleep");
  const [focusCell, setFocusCell] = useState(cellIndex(0, 8));
  const painting = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const { activities, transit, unclaimed } = tallyWeek(grid);
  const committed = WEEK_CELLS - unclaimed;

  const applyBrush = useCallback(
    (indices: number[], onlyFree = false) => {
      if (indices.length === 0) return;
      const next = [...grid] as WeekCell[];
      let changed = false;
      for (const index of indices) {
        // The commute is placed by the budget, so it is never repainted here.
        if (next[index] === "transit") continue;
        if (onlyFree && next[index] !== null) continue;
        const value: WeekCell = brush === "erase" ? null : brush;
        if (next[index] !== value) {
          next[index] = value;
          changed = true;
        }
      }
      if (changed) onGridChange(next);
    },
    [brush, grid, onGridChange],
  );

  const cellFromPoint = (x: number, y: number): number | null => {
    const element = document.elementFromPoint(x, y);
    const cell = element?.closest<HTMLElement>("[data-cell]");
    if (!cell || !gridRef.current?.contains(cell)) return null;
    return Number(cell.dataset.cell);
  };

  // Pointer move is resolved by hit-testing rather than per-cell enter handlers
  // so a touch drag keeps painting past its initial target.
  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    const index = cellFromPoint(event.clientX, event.clientY);
    if (index === null) return;
    event.preventDefault();
    painting.current = true;
    setFocusCell(index);
    applyBrush([index]);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!painting.current) return;
    const index = cellFromPoint(event.clientX, event.clientY);
    if (index !== null) applyBrush([index]);
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const day = cellDay(index);
    const hour = cellHour(index);
    let next: number | null = null;
    if (event.key === "ArrowUp") next = cellIndex(day, Math.max(0, hour - 1));
    else if (event.key === "ArrowDown") next = cellIndex(day, Math.min(HOURS_PER_DAY - 1, hour + 1));
    else if (event.key === "ArrowLeft") next = cellIndex(Math.max(0, day - 1), hour);
    else if (event.key === "ArrowRight") next = cellIndex(Math.min(DAYS_PER_WEEK - 1, day + 1), hour);
    else if (event.key === "Home") next = cellIndex(day, 0);
    else if (event.key === "End") next = cellIndex(day, HOURS_PER_DAY - 1);
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      applyBrush([index]);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setFocusCell(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next}"]`)?.focus();
  };

  const fillHour = (hour: number) => {
    applyBrush(Array.from({ length: DAYS_PER_WEEK }, (_, day) => cellIndex(day, hour)), true);
  };

  const fillDay = (day: number) => {
    applyBrush(Array.from({ length: HOURS_PER_DAY }, (_, hour) => cellIndex(day, hour)), true);
  };

  const clearWeek = () => {
    onGridChange(grid.map((cell) => (cell === "transit" ? "transit" : null)));
  };

  return (
    <div className="timetable-step">
      <div className="timetable-main">
        <PlannerHeading
          title="Paint the week, one hour at a time"
          hint="168 blocks, one for every hour. Pick an activity, then drag across the hours it takes."

        />

        <div className="brush-bar" role="radiogroup" aria-label="Activity to paint">
          {ACTIVITIES.map((activity) => (
            <button
              type="button"
              role="radio"
              aria-checked={brush === activity.key}
              key={activity.key}
              className={`brush is-${activity.key}${brush === activity.key ? " is-active" : ""}`}
              onClick={() => setBrush(activity.key)}
            >
              <span className="brush__swatch" aria-hidden="true">{activity.stamp}</span>
              <span className="brush__text">
                <strong>{activity.label}</strong>
                <b>{activities[activity.key]}h</b>
              </span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={brush === "erase"}
            className={`brush is-erase${brush === "erase" ? " is-active" : ""}`}
            onClick={() => setBrush("erase")}
          >
            <span className="brush__swatch" aria-hidden="true">·</span>
            <span className="brush__text">
              <strong>Clear hours</strong>
              <b>{unclaimed}h free</b>
            </span>
          </button>
        </div>

        <div className="week">
          <div className="week__days" aria-hidden="true">
            <span className="week__corner" />
            {DAY_LABELS.map((day, index) => (
              <button type="button" key={day} className="week__day" onClick={() => fillDay(index)} title={`Fill free hours on ${day}`}>
                {day}
              </button>
            ))}
          </div>

          <div className="week__body">
            <div className="week__hours" aria-hidden="true">
              {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
                <button
                  type="button"
                  key={hour}
                  className={`week__hour${hour % 6 === 0 ? " is-marked" : ""}`}
                  onClick={() => fillHour(hour)}
                  title={`Fill free ${readableHour(hour)} hours across the week`}
                >
                  {hour % 2 === 0 ? hourLabel(hour) : ""}
                </button>
              ))}
            </div>

            <div
              className="week__grid"
              ref={gridRef}
              role="group"
              aria-label="Week of 168 hours"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
            >
              {Array.from({ length: WEEK_CELLS }, (_, index) => {
                const cell = grid[index];
                const day = cellDay(index);
                const hour = cellHour(index);
                const name = cell ? CELL_NAMES[cell] : "free";
                return (
                  <button
                    type="button"
                    key={index}
                    data-cell={index}
                    className={`week__cell${cell ? ` is-${cell}` : ""}${hour % 6 === 0 ? " is-hour-mark" : ""}`}
                    tabIndex={index === focusCell ? 0 : -1}
                    aria-label={`${DAY_LABELS[day]} ${readableHour(hour)}, ${name}`}
                    onFocus={() => setFocusCell(index)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  >
                    <span aria-hidden="true">{cell === "transit" ? "→" : cell ? ACTIVITIES.find((a) => a.key === cell)?.stamp : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <aside className="week-read" aria-live="polite">
        <div className={`week-read__free${unclaimed < 0 ? " is-over" : unclaimed < 25 ? " is-tight" : ""}`}>
          <span>Unclaimed</span>
          <strong>{unclaimed}<em>h</em></strong>
          <div className="week-read__meter" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (committed / WEEK_CELLS) * 100)}%` }} />
          </div>
          <small>{committed} of 168 hours committed</small>
          <p>
            {unclaimed < 25
              ? "Meals, chores, and the unexpected still need hours. Free some blocks."
              : "Enough room left for meals, chores, and the things you cannot schedule."}
          </p>
        </div>

        <div className="week-read__transit">
          <span>Commute</span>
          <strong>{transit}<em>h</em></strong>
          <small>{transitLabel} — set in the budget, locked here.</small>
        </div>

        <dl className="week-read__list">
          {ACTIVITIES.map((activity) => (
            <div key={activity.key}>
              <dt>
                <span className={`week-read__key is-${activity.key}`} aria-hidden="true" />
                {activity.label}
              </dt>
              <dd>{activities[activity.key]}h</dd>
            </div>
          ))}
        </dl>

        <button type="button" className="week-read__clear" onClick={clearWeek}>
          Clear every hour
        </button>
      </aside>
    </div>
  );
}
