import type { LifestyleFocusOption } from "../lifestyleDecisions";
import { PlannerHeading } from "./PlannerFrame";

interface DirectionStepProps {
  options: readonly LifestyleFocusOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/* Both dimensions can land on "holds steady", so each chip names the dimension
   it reports on. Two identical-looking chips would tell the player nothing. */
const BUDGET_COPY: Record<LifestyleFocusOption["budgetEffect"], string> = {
  save: "Money · builds up",
  balanced: "Money · holds steady",
  spend: "Money · spends down",
};

const TIME_COPY: Record<LifestyleFocusOption["timeEffect"], string> = {
  lighter: "Time · frees hours",
  balanced: "Time · holds steady",
  heavier: "Time · costs hours",
};

export function DirectionStep({ options, selectedId, onSelect }: DirectionStepProps) {
  return (
    <div className="direction-step">
      <PlannerHeading
        title="Which road does this year take?"
        hint="This is the one choice the journey records. The budget and the week follow from it."

      />

      <div className="direction-roads" role="radiogroup" aria-label="Direction for the year">
        {options.map((choice) => {
          const selected = choice.id === selectedId;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              key={choice.id}
              className={`direction-road${selected ? " is-selected" : ""}`}
              onClick={() => onSelect(choice.id)}
            >
              <span className="direction-road__post" aria-hidden="true" />
              <span className="direction-road__plate">
                <strong>{choice.label}</strong>
                <small>{choice.description}</small>
              </span>
              <span className="direction-road__signals">
                <span className={`direction-signal is-${choice.budgetEffect}`}>{BUDGET_COPY[choice.budgetEffect]}</span>
                <span className={`direction-signal is-time-${choice.timeEffect}`}>{TIME_COPY[choice.timeEffect]}</span>
              </span>
              <span className="direction-road__tradeoff">{choice.tradeoff}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
