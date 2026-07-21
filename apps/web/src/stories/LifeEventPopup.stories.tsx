import type { Meta, StoryObj } from "@storybook/react-vite";
import { LifeEventPopup } from "../labs/decision-travel/LifeEventPopup";
import { catalogNode, mockContext, noop } from "./fixtures";

const meta = {
  title: "Decisions/Life event popup",
  component: LifeEventPopup,
  args: { onChoose: noop, ctx: mockContext({ age: 24 }), age: 24 },
  argTypes: {
    showMap: { control: "boolean", description: "Show the watercolour route preview beside the choices." },
  },
  parameters: {
    docs: {
      description: {
        component:
          "The modal shown at a crossroads. The overlay is top-aligned and scrollable at every width — a 20-branch node builds a card taller than the viewport, and centring it used to put the first and last options out of reach.",
      },
    },
  },
} satisfies Meta<typeof LifeEventPopup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A forced crossroads: five roads out of high school, beside the route map. */
export const Crossroads: Story = {
  args: { node: catalogNode("hs-launch"), age: 18, ctx: mockContext({ age: 18, stage: "pre-launch" }) },
};

/** An optional opportunity — the only case that offers "Maybe later". */
export const Opportunity: Story = {
  args: { node: catalogNode("first-home"), age: 28, ctx: mockContext({ age: 28, stage: "working" }), onDismiss: noop },
};

/**
 * Two branches, one of them the inert decline. Both currently resolve to the
 * same route direction, so both eyebrows read "STAY THE COURSE" — the label is
 * not carrying information here.
 */
export const TwoBranchDecline: Story = {
  args: { node: catalogNode("work-cert"), age: 24, onDismiss: noop },
};

/**
 * The regression case. 20 branches at ~66px each builds a card far taller than
 * the viewport; every option has to stay reachable by scroll.
 */
export const TwentyBranches: Story = {
  args: { node: catalogNode("declare-major"), age: 18 },
};

/** Choices only, no map — the layout the `showMap={false}` branch produces. */
export const WithoutMap: Story = {
  args: { node: catalogNode("declare-major"), age: 18, showMap: false },
};

/**
 * Changing major while already studying nursing: that one option is gated. A
 * blocked option keeps its description and adds the reason on its own line, so
 * a blocker never overwrites the figure you are comparing against.
 */
export const BlockedOption: Story = {
  args: {
    node: catalogNode("swap-major"),
    age: 20,
    ctx: mockContext({ age: 20, flags: { major: "nursing" } }),
  },
};
