import type { Meta, StoryObj } from "@storybook/react-vite";
import { CAREER_CHOICES, MAJOR_CHOICES, PET_CHOICES, type DecisionChoiceDetails } from "../labs/decision-travel/decisionCatalog";
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
          "Shown when a player commits to a major, starter role, or pet. The front carries the illustration and the pitch; the back itemises the setup estimate and ongoing commitment.",
      },
    },
  },
} satisfies Meta<typeof RoleThreeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Build card props out of a real catalog row so stories cannot invent data. */
function cardArgs(details: DecisionChoiceDetails, title: string) {
  const isMajor = details.kind === "major";
  const isPet = details.kind === "pet";
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return {
    artworkSrc: details.artwork?.src ?? (isPet ? "/role-cards/pets/adult-dog.svg" : "/role-cards/roles/retail.svg"),
    title,
    category: details.category,
    outlook: details.outlook,
    note: details.note,
    startupSummary:
      details.startupSummary ??
      (isMajor
        ? "Plan for the tuition, materials, and practical requirements across this degree."
        : isPet
          ? "Prepare the habitat, health baseline, and supplies before this companion comes home."
          : "Prepare the equipment and credentials needed to begin this role."),
    startupItems: details.startupItems ?? [],
    cost: details.cost,
    timeLabel: details.timeLabel,
    startingSalary: details.startingSalary,
    provisionsLabel: isPet ? "ADOPTION PROVISIONS" : undefined,
    costQuestion: isPet ? `Why this homecoming starts at ${money(details.cost)}` : undefined,
    leftFooterLabel: isPet ? "WEEKLY CARE" : undefined,
    leftFooterValue: isPet ? `${details.weeklyHours ?? 0} hours` : undefined,
    rightFooterLabel: isPet ? "ONGOING COST" : undefined,
    rightFooterValue: isPet ? `${money(details.monthlyCost ?? 0)}/mo` : undefined,
  };
}

const byId = (rows: readonly DecisionChoiceDetails[], id: string) => {
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error(`Story fixture: no catalog row "${id}"`);
  return row;
};

const career = (id: string, title: string) => cardArgs(byId(CAREER_CHOICES, id), title);
const major = (id: string, title: string) => cardArgs(byId(MAJOR_CHOICES, id), title);
const pet = (id: string, title: string) => cardArgs(byId(PET_CHOICES, id), title);

/** A starter role with a fully itemised startup cost on the back. */
export const StarterRole: Story = {
  args: career("junior-web-developer", "Junior web developer"),
};

/** A college program: the same card, with tuition-shaped costs. */
export const CollegeMajor: Story = {
  args: major("computer-science", "Computer science"),
};

/** A pet charter with care time, monthly cost, and habitat provisions. */
export const PetCompanion: Story = {
  args: pet("adult-dog", "Adult dog"),
};

/** The pet catalog's longest commitment and highest-care setup. */
export const LifetimePetCommitment: Story = {
  args: pet("tortoise", "Tortoise"),
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
    const rows = [...CAREER_CHOICES, ...MAJOR_CHOICES, ...PET_CHOICES];
    const longest = rows.reduce((a, b) => (b.note.length > a.note.length ? b : a));
    return cardArgs(longest, "Environmental science and policy");
  })(),
};
