import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { DecisionExperience } from "../labs/decision-travel/DecisionExperience";
import { selectDecisionMap } from "../labs/decision-travel/decisionMaps";
import { routeKindForNode } from "../labs/decision-travel/journeyGraph";
import { catalogNode, mockContext, noop } from "./fixtures";

/**
 * `DecisionExperience` routes on the node it is handed: a lifestyle id opens
 * the year planner, a node with a catalog entry opens the explorer, and
 * anything else falls through to the floating road signs.
 */
const meta = {
  title: "Decisions/Decision experience",
  component: DecisionExperience,
  args: { onChoose: noop, onDismiss: noop, onBackToMap: noop },
} satisfies Meta<typeof DecisionExperience>;

export default meta;
type Story = StoryObj<typeof meta>;

function scene(nodeId: string, age: number, opts: { takeHome?: number } = {}) {
  const node = catalogNode(nodeId);
  const kind = routeKindForNode(node);
  return {
    node,
    age,
    ctx: mockContext({ age, takeHome: opts.takeHome ?? 2_400 }),
    map: selectDecisionMap(kind, `${nodeId}:${age}`, { branchCount: node.branches.length }),
  };
}

/** The major chooser: 20 programs, searchable and sortable, with a detail rail. */
export const MajorExplorer: Story = {
  args: scene("declare-major", 18),
};

/** The same explorer in its career flavour — starter roles instead of programs. */
export const JobExplorer: Story = {
  args: scene("entry-track", 18),
};

/**
 * The root fork at 18. No catalog entry, so it renders as floating road signs
 * positioned by the route map's path anchors.
 */
export const RoadSigns: Story = {
  args: scene("hs-launch", 18),
};

/**
 * Every option gated off. Worth checking regularly: the popup and the explorer
 * both need to leave a way out when nothing is affordable.
 */
export const NothingAffordable: Story = {
  args: scene("entry-track", 18, { takeHome: 0 }),
};

/**
 * The commitment page for a starter role, reached the way a player reaches it:
 * the explorer pre-selects the first result, and "Review startup for…" opens
 * the charter card in place of the list.
 */
export const RoleCommitmentPage: Story = {
  args: scene("entry-track", 18),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /review startup for/i }));
    await canvas.findByRole("button", { name: /setup & start/i });
  },
};

/** The same page for a college program — tuition framing, different CTA. */
export const MajorCommitmentPage: Story = {
  args: scene("declare-major", 18),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /review college plan for/i }));
    await canvas.findByRole("button", { name: /plan for/i });
  },
};
