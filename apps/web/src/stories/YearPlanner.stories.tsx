import type { Meta, StoryObj } from "@storybook/react-vite";
import { createLifestyleDecision } from "../labs/decision-travel/lifestyleDecisions";
import { LifestyleYearPlanner, plannerStepsForAge } from "../labs/decision-travel/planner/LifestyleYearPlanner";
import { mockContext, noop } from "./fixtures";

const meta = {
  title: "Year planner/Screens",
  component: LifestyleYearPlanner,
  parameters: {
    docs: {
      description: {
        component:
          "Three independent instruments for one year of life. A year asks for whichever it needs: ages 18–19 and every fifth year stack all three, the years between re-evaluate a single thing. The step rail only appears when more than one is asked for.",
      },
    },
  },
  argTypes: {
    initialStep: {
      control: "inline-radio",
      options: ["direction", "budget", "timetable"],
      description: "Which instrument to open. Ignored if the year did not ask for it.",
    },
    age: { control: { type: "number", min: 18, max: 40 } },
  },
  args: { onChoose: noop, onBackToMap: noop },
} satisfies Meta<typeof LifestyleYearPlanner>;

export default meta;
type Story = StoryObj<typeof meta>;

const year = (age: number) => ({
  age,
  node: createLifestyleDecision(age, age <= 21 ? "school" : "working"),
  ctx: mockContext({ age, stage: age <= 21 ? "school" : "working" }),
});

/** The one choice the rule engine records. Everything else follows from it. */
export const Direction: Story = {
  args: { ...year(19), initialStep: "direction" },
};

/** Each choice writes a line in the ledger; the margin is a balance beam that tips. */
export const Budget: Story = {
  args: { ...year(19), initialStep: "budget" },
};

/**
 * The signature surface: 168 blocks, one per hour. Pick an activity and drag.
 * The commute is placed by the budget and locked here.
 */
export const Timetable: Story = {
  args: { ...year(19), initialStep: "timetable" },
};

/** No income yet, so the ledger's balance beam sits level and says so. */
export const BudgetBeforeAnyIncome: Story = {
  args: {
    ...year(18),
    ctx: mockContext({ age: 18, stage: "school", takeHome: 0 }),
    initialStep: "budget",
  },
};

/**
 * A studio alone in an urban core on a student income. The beam tips the other
 * way and the whole panel takes the short-of-money wash.
 */
export const BudgetOverspent: Story = {
  args: {
    ...year(19),
    ctx: mockContext({ age: 19, stage: "school", takeHome: 1_100 }),
    initialStep: "budget",
  },
};

/**
 * A quiet year. Nothing scripted happened, so the year asks for the direction
 * and one re-evaluation only — note the two-step rail instead of three.
 */
export const QuietYearSingleReview: Story = {
  args: { ...year(23), initialStep: "timetable" },
  parameters: {
    docs: {
      description: {
        story: `Age 23 asks for: ${plannerStepsForAge(23).join(" → ")}.`,
      },
    },
  },
};

/** An anchor year, which resets the whole plan across all three instruments. */
export const AnchorYearAllThree: Story = {
  args: { ...year(25), initialStep: "direction" },
  parameters: {
    docs: {
      description: {
        story: `Age 25 asks for: ${plannerStepsForAge(25).join(" → ")}.`,
      },
    },
  },
};
