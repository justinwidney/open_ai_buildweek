import type { ReactNode } from "react";
import { PLANNER_STEP_TITLES, type PlannerStepId } from "./plannerModel";

interface PlannerFrameProps {
  age: number;
  eyebrow: string;
  title: string;
  prompt: string;
  /** Every step this year asked for, in order. A single-step year hides the rail. */
  steps: readonly PlannerStepId[];
  activeStep: PlannerStepId;
  onStepChange: (step: PlannerStepId) => void;
  onBackToMap?: () => void;
  footer: ReactNode;
  children: ReactNode;
}

export function PlannerFrame({
  age,
  eyebrow,
  title,
  prompt,
  steps,
  activeStep,
  onStepChange,
  onBackToMap,
  footer,
  children,
}: PlannerFrameProps) {
  const activeIndex = steps.indexOf(activeStep);

  return (
    <main className="planner-layer">
      <section className="planner" aria-labelledby="planner-title">
        <span className="planner__corner planner__corner--tl" aria-hidden="true" />
        <span className="planner__corner planner__corner--tr" aria-hidden="true" />
        <span className="planner__corner planner__corner--bl" aria-hidden="true" />
        <span className="planner__corner planner__corner--br" aria-hidden="true" />

        <header className="planner__header">
          {onBackToMap && (
            <button type="button" className="planner__back" onClick={onBackToMap}>
              <span aria-hidden="true">←</span>
              Journey map
            </button>
          )}

          <div className="planner__heading">
            <span className="planner__eyebrow">{eyebrow}</span>
            <h2 id="planner-title">{title}</h2>
            <p>{prompt}</p>
          </div>

          <div className="planner__age" aria-label={`Age ${age}`}>
            <span aria-hidden="true">{age}</span>
          </div>
        </header>

        {steps.length > 1 && (
          <nav className="planner__rail" aria-label="Planning steps">
            {steps.map((step, index) => (
              <button
                type="button"
                key={step}
                className={`planner__rail-step${step === activeStep ? " is-active" : ""}${index < activeIndex ? " is-done" : ""}`}
                aria-current={step === activeStep ? "step" : undefined}
                onClick={() => onStepChange(step)}
              >
                <span className="planner__rail-dot" aria-hidden="true" />
                {PLANNER_STEP_TITLES[step]}
              </button>
            ))}
          </nav>
        )}

        <div className="planner__sheet">{children}</div>

        <footer className="planner__footer">{footer}</footer>
      </section>
    </main>
  );
}

/** Section heading used inside each step. */
export function PlannerHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="planner-heading">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}
