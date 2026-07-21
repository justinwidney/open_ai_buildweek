import type { LifeStage } from "@control-ai/engine";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { DecisionExperience } from "../labs/decision-travel/DecisionExperience";
import { selectDecisionMap } from "../labs/decision-travel/decisionMaps";
import { routeKindForNode } from "../labs/decision-travel/journeyGraph";
import { catalogNode, mockContext, noop } from "./fixtures";

/**
 * The shipped decision surface. Catalog-backed nodes render the responsive
 * illustrated deck; lifestyle nodes open the year planner; other nodes render
 * floating road signs.
 */
const meta = {
  title: "Decisions/Card decks",
  component: DecisionExperience,
  args: { onChoose: noop, onDismiss: noop, onBackToMap: noop },
  globals: { viewport: { value: "deckWide", isRotated: false } },
} satisfies Meta<typeof DecisionExperience>;

export default meta;
type Story = StoryObj<typeof meta>;

interface SceneOptions {
  takeHome?: number;
  stage?: LifeStage;
  flags?: Record<string, string | number | boolean>;
}

function scene(nodeId: string, age: number, opts: SceneOptions = {}) {
  const node = catalogNode(nodeId);
  const kind = routeKindForNode(node);
  return {
    node,
    age,
    ctx: mockContext({
      age,
      takeHome: opts.takeHome ?? 2_400,
      stage: opts.stage,
      flags: opts.flags,
    }),
    map: selectDecisionMap(kind, `${nodeId}:${age}`, { branchCount: node.branches.length }),
  };
}

const jobScene = () => scene("entry-track", 18, { stage: "working", flags: { wentToWork: true } });
const majorScene = () => scene("declare-major", 18, { stage: "school" });
const petScene = () => scene("rng-pet", 24, { stage: "working" });

async function expectVisibleCards(canvasElement: HTMLElement, count: number) {
  const canvas = within(canvasElement);
  await expect(await canvas.findAllByRole("button", { name: /Open interactive card/i })).toHaveLength(count);
}

async function openFirstCard(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const cards = await canvas.findAllByRole("button", { name: /Open interactive card/i });
  await userEvent.click(cards[0]!);
  return canvas;
}

/** The complete starter-job catalog on its dedicated five-card screen. */
export const JobsDesktopFiveCards: Story = {
  args: jobScene(),
  play: async ({ canvasElement }) => expectVisibleCards(canvasElement, 5),
};

/** The same job deck below the 1000px breakpoint, three cards at a time. */
export const JobsCompactThreeCards: Story = {
  args: jobScene(),
  globals: { viewport: { value: "deckCompact", isRotated: false } },
  play: async ({ canvasElement }) => expectVisibleCards(canvasElement, 3),
};

/** All college programs with tuition, duration, pay, and challenge data. */
export const MajorsDesktopFiveCards: Story = {
  args: majorScene(),
  play: async ({ canvasElement }) => expectVisibleCards(canvasElement, 5),
};

/** The compact three-card version of the college deck. */
export const MajorsCompactThreeCards: Story = {
  args: majorScene(),
  globals: { viewport: { value: "deckCompact", isRotated: false } },
  play: async ({ canvasElement }) => expectVisibleCards(canvasElement, 3),
};

/** Switching majors keeps the existing-major gate and the separate keep action. */
export const SwitchMajorDeck: Story = {
  args: scene("swap-major", 20, { stage: "school", flags: { major: "nursing" } }),
};

/** Every illustrated companion, with “Not now” kept outside the deck. */
export const PetsDesktopFiveCards: Story = {
  args: petScene(),
  play: async ({ canvasElement }) => expectVisibleCards(canvasElement, 5),
};

/** Compact pet selection still presents exactly three illustrated choices. */
export const PetsCompactThreeCards: Story = {
  args: petScene(),
  globals: { viewport: { value: "deckCompact", isRotated: false } },
  play: async ({ canvasElement }) => expectVisibleCards(canvasElement, 3),
};

/** Search narrows the job deck using the real catalog text. */
export const SearchJobs: Story = {
  args: jobScene(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Search jobs" }), "bookkeeping");
    await expect(await canvas.findAllByRole("button", { name: /Open interactive card/i })).toHaveLength(1);
    await canvas.findByRole("button", { name: /Bookkeeping clerk.*Open interactive card/i });
  },
};

/** Major search narrows the deck without a separate category-pill row. */
export const SearchMajors: Story = {
  args: majorScene(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Search majors" }), "nursing");
    await expect(await canvas.findAllByRole("button", { name: /Open interactive card/i })).toHaveLength(1);
    await canvas.findByRole("button", { name: /Nursing.*Open interactive card/i });
  },
};

/** Pet search covers care-oriented catalog text without category pills. */
export const SearchPets: Story = {
  args: petScene(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Search pets" }), "tortoise");
    await expect(await canvas.findAllByRole("button", { name: /Open interactive card/i })).toHaveLength(1);
    await canvas.findByRole("button", { name: /Tortoise.*Open interactive card/i });
  },
};

/** The right arrow replaces the full five-card set and announces its position. */
export const NextJobSet: Story = {
  args: jobScene(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Show next set of cards" }));
    await canvas.findByText(/Set 2 of 4/i);
  },
};

/** Shuffle randomizes the catalog and returns the deck to its first set. */
export const ShuffledJobs: Story = {
  args: jobScene(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Shuffle/i }));
    await canvas.findByText(/Set 1 of 4/i);
  },
};

/** Clicking a job preview opens its live, mouse-spinnable Three.js charter. */
export const JobInteractiveCard: Story = {
  args: jobScene(),
  play: async ({ canvasElement }) => {
    const canvas = await openFirstCard(canvasElement);
    await canvas.findByRole("button", { name: /Back to roles/i });
    await canvas.findByRole("button", { name: /setup & start/i });
  },
};

/** College selection opens the same 3D card with program-specific costs. */
export const MajorInteractiveCard: Story = {
  args: majorScene(),
  play: async ({ canvasElement }) => {
    const canvas = await openFirstCard(canvasElement);
    await canvas.findByRole("button", { name: /Back to programs/i });
    await canvas.findByRole("button", { name: /plan for/i });
  },
};

/** Pet selection opens a care-specific 3D card and adoption action. */
export const PetInteractiveCard: Story = {
  args: petScene(),
  play: async ({ canvasElement }) => {
    const canvas = await openFirstCard(canvasElement);
    await canvas.findByRole("button", { name: /Back to pets/i });
    await canvas.findByRole("button", { name: /Welcome .* setup/i });
  },
};

/** The root fork remains covered alongside the deck-based decisions. */
export const RoadSigns: Story = {
  args: scene("hs-launch", 18),
};

/** Eligibility failures remain visible and the deck still leaves a way out. */
export const NothingAffordable: Story = {
  args: scene("entry-track", 18, { takeHome: 0, stage: "working", flags: { wentToWork: true } }),
};
