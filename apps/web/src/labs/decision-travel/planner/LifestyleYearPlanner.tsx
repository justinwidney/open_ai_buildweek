import { useMemo, useState } from "react";
import {
  ANNUAL_LIFE_PLAN_SCHEMA_VERSION,
  createAnnualLifePlanBranch,
  type DecisionBranch,
  type DecisionNode,
  type LifeContext,
} from "@control-ai/engine";
import { lifestyleFocusForAge } from "../lifestyleDecisions";
import { PlannerFrame } from "./PlannerFrame";
import { DirectionStep } from "./DirectionStep";
import { BudgetStep } from "./BudgetStep";
import { TimetableStep } from "./TimetableStep";
import {
  LIVING_OPTIONS,
  LOCATION_OPTIONS,
  TRANSIT_OPTIONS,
  PLANNER_STEP_TITLES,
  reflowTransit,
  suggestedWeek,
  tallyWeek,
  type PlannerStepId,
  type WeekCell,
} from "./plannerModel";
import "./planner.css";

interface LifestyleYearPlannerProps {
  node: DecisionNode;
  ctx: LifeContext;
  age: number;
  onChoose: (branch: DecisionBranch) => void;
  onBackToMap?: () => void;
  /** Open straight to one instrument, for years that re-evaluate a single thing. */
  initialStep?: PlannerStepId;
  /**
   * Run this instrument alone: no step rail, and Save commits the year with the
   * other instruments left at their defaults. Set when the player picked this
   * one off the map instead of walking the whole plan.
   */
  soloStep?: PlannerStepId;
}

/**
 * Which instruments a year asks for. The first two years and every fifth year
 * reset the whole plan; the years between re-evaluate a single thing, because
 * nothing has happened that would justify rebuilding the week from scratch.
 * Direction is always present — the engine records it as the year's outcome.
 */
export function plannerStepsForAge(age: number): readonly [PlannerStepId, ...PlannerStepId[]] {
  if (age <= 19 || age % 5 === 0) return ["direction", "budget", "timetable"];
  return age % 2 === 0 ? ["direction", "budget"] : ["direction", "timetable"];
}

export function LifestyleYearPlanner({ node, ctx, age, onChoose, onBackToMap, initialStep, soloStep }: LifestyleYearPlannerProps) {
  const focus = lifestyleFocusForAge(age);
  const steps = useMemo<readonly [PlannerStepId, ...PlannerStepId[]]>(
    () => soloStep ? [soloStep] : plannerStepsForAge(age),
    [age, soloStep],
  );
  const [activeStep, setActiveStep] = useState<PlannerStepId>(
    initialStep && steps.includes(initialStep) ? initialStep : steps[0],
  );

  const [focusId, setFocusId] = useState(node.branches[1]?.id ?? node.branches[0]?.id ?? "");
  const [livingId, setLivingId] = useState(ctx.stage === "school" ? "campus" : "roommates");
  const [locationId, setLocationId] = useState(ctx.stage === "school" ? "campus-core" : "suburban");
  const [transitId, setTransitId] = useState(ctx.stage === "school" ? "transit" : "car");
  const [groceries, setGroceries] = useState(360);

  const living = LIVING_OPTIONS.find((item) => item.id === livingId) ?? LIVING_OPTIONS[2];
  const location = LOCATION_OPTIONS.find((item) => item.id === locationId) ?? LOCATION_OPTIONS[2];
  const transit = TRANSIT_OPTIONS.find((item) => item.id === transitId) ?? TRANSIT_OPTIONS[3];

  const [week, setWeek] = useState<WeekCell[]>(() => suggestedWeek(ctx.stage, transit.weeklyHours));

  const selectedFocus = focus.options.find((item) => item.id === focusId) ?? focus.options[0];
  const totals = tallyWeek(week);
  const monthlyTakeHome = (ctx.finances?.monthlyTakeHomeCents ?? 0) / 100;

  // Changing how you get around moves locked commute blocks without disturbing
  // anything already painted.
  const chooseTransit = (id: string) => {
    const next = TRANSIT_OPTIONS.find((item) => item.id === id);
    if (!next) return;
    setTransitId(id);
    setWeek((current) => reflowTransit(current, next.weeklyHours));
  };

  const stepIndex = steps.indexOf(activeStep);
  const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
  const nextStep = steps[stepIndex + 1];

  const commitPlan = () => {
    const selectedBranch = node.branches.find((branch) => branch.id === focusId) ?? node.branches[0];
    if (!selectedBranch || !selectedFocus) return;
    onChoose(
      createAnnualLifePlanBranch(node.id, {
        schemaVersion: ANNUAL_LIFE_PLAN_SCHEMA_VERSION,
        age,
        focus: {
          id: selectedBranch.id,
          label: selectedBranch.label,
          description: selectedBranch.description,
          tradeoff: selectedFocus.tradeoff,
        },
        living: {
          id: living.id,
          label: living.label,
          housingTenure: living.housingTenure,
          housingDollars: living.housing,
          utilitiesDollars: living.utilities,
          moveCostDollars: living.moveCost,
        },
        location: { id: location.id, label: location.label, monthlyDeltaDollars: location.monthlyDelta },
        transit: { id: transit.id, label: transit.label, monthlyDollars: transit.monthly, weeklyHours: totals.transit },
        groceriesMonthlyDollars: groceries,
        schedule: totals.activities,
      }),
    );
  };

  /**
   * The footer carries the direction forward, because that is what Save
   * commits and it is the only thing the later steps do not show on their own.
   * On the direction step itself the selected card already says it.
   */
  const readout = activeStep === "direction" ? null : {
    label: "Direction for the year",
    value: selectedFocus?.label ?? "—",
    note: selectedFocus?.tradeoff ?? "",
  };

  return (
    <PlannerFrame
      age={age}
      eyebrow={steps.length > 1 ? `Age ${age} · life design` : `Age ${age} · ${PLANNER_STEP_TITLES[activeStep].toLowerCase()}`}
      title={focus.title}
      prompt={focus.prompt}
      steps={steps}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      onBackToMap={onBackToMap}
      footer={
        <>
          {readout && (
            <div className="planner__readout">
              <span>{readout.label}</span>
              <b>{readout.value}</b>
              <small>{readout.note}</small>
            </div>
          )}
          {previousStep && (
            <button type="button" className="planner__secondary" onClick={() => setActiveStep(previousStep)}>
              Back
            </button>
          )}
          {nextStep ? (
            <button type="button" className="planner__primary" onClick={() => setActiveStep(nextStep)}>
              Next: {PLANNER_STEP_TITLES[nextStep].toLowerCase()}
            </button>
          ) : (
            <button type="button" className="planner__primary" onClick={commitPlan}>
              Save age {age} plan
            </button>
          )}
        </>
      }
    >
      {activeStep === "direction" && (
        <DirectionStep options={focus.options} selectedId={focusId} onSelect={setFocusId} />
      )}
      {activeStep === "budget" && (
        <BudgetStep
          living={living}
          location={location}
          transit={transit}
          groceries={groceries}
          monthlyTakeHome={monthlyTakeHome}
          onLiving={setLivingId}
          onLocation={setLocationId}
          onTransit={chooseTransit}
          onGroceries={setGroceries}
        />
      )}
      {activeStep === "timetable" && (
        <TimetableStep grid={week} onGridChange={setWeek} transitLabel={transit.label} />
      )}
    </PlannerFrame>
  );
}
