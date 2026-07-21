import { PlannerHeading } from "./PlannerFrame";
import {
  dollars,
  LIVING_OPTIONS,
  LOCATION_OPTIONS,
  TRANSIT_OPTIONS,
  type LivingOption,
  type LocationOption,
  type TransitOption,
} from "./plannerModel";

interface BudgetStepProps {
  living: LivingOption;
  location: LocationOption;
  transit: TransitOption;
  groceries: number;
  monthlyTakeHome: number;
  onLiving: (id: string) => void;
  onLocation: (id: string) => void;
  onTransit: (id: string) => void;
  onGroceries: (value: number) => void;
}

/** One row of the ledger. `signed` prints a location adjustment that can be negative. */
function LedgerLine({ label, note, amount, signed = false }: { label: string; note: string; amount: number; signed?: boolean }) {
  const prefix = signed && amount > 0 ? "+" : "";
  return (
    <div className="ledger__line">
      <span className="ledger__label">
        {label}
        <small>{note}</small>
      </span>
      <span className="ledger__amount">{prefix}{dollars(amount)}</span>
    </div>
  );
}

export function BudgetStep({
  living,
  location,
  transit,
  groceries,
  monthlyTakeHome,
  onLiving,
  onLocation,
  onTransit,
  onGroceries,
}: BudgetStepProps) {
  const monthly = Math.max(0, living.housing + living.utilities + location.monthlyDelta + transit.monthly + groceries);
  const margin = monthlyTakeHome - monthly;
  const hasIncome = monthlyTakeHome > 0;
  // Beam tilt is capped so an extreme month still reads as a beam, not a wall,
  // and so the rotated bar stays inside its own 64px stage.
  const tilt = hasIncome ? Math.max(-7, Math.min(7, (margin / Math.max(monthlyTakeHome, 1)) * 24)) : 0;
  const groceryShare = hasIncome ? Math.round((groceries / monthlyTakeHome) * 100) : null;

  return (
    <div className="budget-step">
      <div className="budget-controls">
        <PlannerHeading title="Where the money goes" hint="Every choice writes a line in the ledger." />

        <fieldset className="budget-group">
          <legend>Home</legend>
          <div className="budget-options">
            {LIVING_OPTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`budget-option${item.id === living.id ? " is-selected" : ""}`}
                aria-pressed={item.id === living.id}
                onClick={() => onLiving(item.id)}
              >
                <strong>{item.label}</strong>
                <b>{dollars(item.housing + item.utilities)}</b>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="budget-group">
          <legend>Place</legend>
          <div className="budget-options">
            {LOCATION_OPTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`budget-option${item.id === location.id ? " is-selected" : ""}`}
                aria-pressed={item.id === location.id}
                onClick={() => onLocation(item.id)}
              >
                <strong>{item.label}</strong>
                <b>{item.monthlyDelta > 0 ? "+" : ""}{dollars(item.monthlyDelta)}</b>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="budget-group">
          <legend>Getting around</legend>
          <div className="budget-options">
            {TRANSIT_OPTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`budget-option${item.id === transit.id ? " is-selected" : ""}`}
                aria-pressed={item.id === transit.id}
                onClick={() => onTransit(item.id)}
              >
                <strong>{item.label}</strong>
                <b>{dollars(item.monthly)}</b>
                <small>{item.weeklyHours}h a week on the move</small>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="budget-slider">
          <span className="budget-slider__top">
            Groceries and household
            <b>{dollars(groceries)}</b>
          </span>
          <input
            type="range"
            min="160"
            max="900"
            step="10"
            value={groceries}
            onChange={(event) => onGroceries(Number(event.target.value))}
          />
          <small>
            {dollars(Math.round(groceries / 4.33))} a week
            {groceryShare !== null ? ` · ${groceryShare}% of take-home` : " · income not established yet"}
          </small>
        </label>
      </div>

      <aside className="ledger" aria-label="Monthly ledger">
        <div className="ledger__head">
          <span>Monthly ledger</span>
          <b>{dollars(monthly)}</b>
        </div>

        <div className="ledger__lines">
          <LedgerLine label="Rent" note={living.label} amount={living.housing} />
          <LedgerLine label="Utilities" note="Power, water, connection" amount={living.utilities} />
          <LedgerLine label="Place adjustment" note={location.label} amount={location.monthlyDelta} signed />
          <LedgerLine label="Getting around" note={transit.label} amount={transit.monthly} />
          <LedgerLine label="Groceries" note="Food and household" amount={groceries} />
        </div>

        <div className={`ledger__beam${!hasIncome ? " is-unknown" : margin < 0 ? " is-short" : ""}`}>
          <div className="ledger__scale" aria-hidden="true">
            <div className="ledger__scale-beam" style={{ transform: `rotate(${-tilt}deg)` }}>
              <span className="ledger__pan ledger__pan--in" />
              <span className="ledger__pan ledger__pan--out" />
            </div>
            <span className="ledger__fulcrum" />
          </div>
          <div className="ledger__beam-read">
            <span>{hasIncome ? (margin < 0 ? "Short each month" : "Left each month") : "No income yet"}</span>
            <strong>{hasIncome ? dollars(margin) : "—"}</strong>
            <small>
              {hasIncome
                ? margin < 0
                  ? `Take-home ${dollars(monthlyTakeHome)} against ${dollars(monthly)} of living costs.`
                  : `Take-home ${dollars(monthlyTakeHome)} covers ${dollars(monthly)} of living costs.`
                : "Choose work or study first, then this balance fills in."}
            </small>
          </div>
        </div>

        <div className="ledger__move">
          <span>Cost to move in</span>
          <b>{dollars(living.moveCost)}</b>
        </div>
      </aside>
    </div>
  );
}
