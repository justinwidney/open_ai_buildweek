import type { Meta, StoryObj } from "@storybook/react-vite";
import { CAREER_CHOICES, MAJOR_CHOICES, type DecisionChoiceDetails } from "../labs/decision-travel/decisionCatalog";
import { RoleThreeCard } from "../labs/decision-travel/RoleThreeCard";
import "../labs/decision-travel/DecisionExperience.css";

/**
 * The charter card: a WebGL plane pair with canvas-drawn parchment textures.
 * Drag it to turn it over, or use the arrow keys. Its palette is pulled from
 * the `--journey-color-*` tokens at mount, so it tracks the design system.
 */
const meta = {
  title: "Cards/Charter card",
  component: RoleThreeCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Shown when a player commits to a major or a starter role. The front carries the illustration and the pitch; the back itemises what the startup estimate actually pays for.",
      },
    },
  },
} satisfies Meta<typeof RoleThreeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Build card props out of a real catalog row so stories cannot invent data. */
function cardArgs(details: DecisionChoiceDetails, title: string) {
  const isMajor = details.kind === "major";
  return {
    artworkSrc: details.artwork?.src ?? "/role-cards/roles/retail.svg",
    title,
    category: details.category,
    outlook: details.outlook,
    note: details.note,
    startupSummary:
      details.startupSummary ??
      (isMajor
        ? "Plan for the tuition, materials, and practical requirements across this degree."
        : "Prepare the equipment and credentials needed to begin this role."),
    startupItems: details.startupItems ?? [],
    cost: details.cost,
    timeLabel: details.timeLabel,
    startingSalary: details.startingSalary,
  };
}

const byId = (rows: readonly DecisionChoiceDetails[], id: string) => {
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error(`Story fixture: no catalog row "${id}"`);
  return row;
};

const career = (id: string, title: string) => cardArgs(byId(CAREER_CHOICES, id), title);
const major = (id: string, title: string) => cardArgs(byId(MAJOR_CHOICES, id), title);

/** A starter role with a fully itemised startup cost on the back. */
export const StarterRole: Story = {
  args: career("junior-web-developer", "Junior web developer"),
};

/** A college program: the same card, with tuition-shaped costs. */
export const CollegeMajor: Story = {
  args: major("computer-science", "Computer science"),
};

/** A trade role — heavier tools, shorter runway to starting. */
export const TradeRole: Story = {
  args: career("construction-laborer", "Construction laborer"),
};

/**
 * No itemised startup costs in the catalog, so the back falls through to the
 * generic summary and the footer alone. Worth keeping an eye on: the back of
 * the card is nearly empty in this state.
 */
export const WithoutItemisedCosts: Story = {
  args: career("retail", "Retail associate"),
};

/**
 * The longest title and note in the catalog, to check the canvas text wrapper.
 * `drawCenteredLines` clamps the title to 2 lines and the note to 3, so
 * anything longer is silently truncated rather than overrunning the artwork.
 */
export const LongestCopy: Story = {
  args: (() => {
    const rows = [...CAREER_CHOICES, ...MAJOR_CHOICES];
    const longest = rows.reduce((a, b) => (b.note.length > a.note.length ? b : a));
    return cardArgs(longest, "Environmental science and policy");
  })(),
};
