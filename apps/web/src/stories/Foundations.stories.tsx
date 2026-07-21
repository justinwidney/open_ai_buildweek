import { useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import "../labs/decision-travel/planner/planner.css";
import "./foundations.css";

/**
 * The token sheets read their values back out of the live stylesheet rather
 * than restating them, so this page cannot drift from journey.tokens.css.
 */
function useTokens(names: readonly string[], scopeClass?: string) {
  const probe = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  // Keyed on the joined names rather than the array itself: a caller that
  // builds its token list inline would otherwise hand this a new array every
  // render and spin the effect forever.
  const key = names.join(",");

  useLayoutEffect(() => {
    const element = probe.current;
    if (!element) return;
    const computed = getComputedStyle(element);
    const next: Record<string, string> = {};
    for (const name of key.split(",")) next[name] = computed.getPropertyValue(name).trim();
    setValues(next);
  }, [key]);

  return {
    values,
    // Scoped tokens (the activity hues live on `.planner`) need a probe that
    // actually sits inside that scope.
    probe: <div ref={probe} className={scopeClass} style={{ display: "none" }} />,
  };
}

const SPACING = ["--sp-1", "--sp-2", "--sp-3", "--sp-4", "--sp-5", "--sp-6", "--sp-7", "--sp-8"];
const RADIUS = ["--r-1", "--r-2", "--r-3", "--r-4", "--r-pill"];
const TYPE: readonly { size: string; lh: string; label: string; usage: string }[] = [
  { size: "--text-label", lh: "--text-label-lh", label: "Label", usage: "Tracked uppercase. 11px is the floor — anything smaller is not legible." },
  { size: "--text-sm", lh: "--text-sm-lh", label: "Small", usage: "Descriptions, notes, option copy." },
  { size: "--text-body", lh: "--text-body-lh", label: "Body", usage: "Prompts and running text." },
  { size: "--text-lg", lh: "--text-lg-lh", label: "Large", usage: "Option titles, ledger figures." },
  { size: "--text-title", lh: "--text-title-lh", label: "Title", usage: "Panel headings." },
  { size: "--text-display", lh: "--text-display-lh", label: "Display", usage: "The one screen title." },
];
const PALETTE = [
  "--journey-color-ink",
  "--journey-color-ink-muted",
  "--journey-color-parchment",
  "--journey-color-parchment-deep",
  "--journey-color-gold",
  "--journey-color-violet",
  "--tone-save",
  "--tone-balanced",
  "--tone-spend",
];
const ACTIVITIES = ["--act-sleep", "--act-work", "--act-study", "--act-friends", "--act-fitness", "--act-transit"];

function SpacingSheet() {
  const { values, probe } = useTokens(SPACING);
  return (
    <div className="fnd">
      {probe}
      <h2>Spacing</h2>
      <p>A strict 4/8 scale. Every padding, margin, and gap in the planner resolves to one of these; raw pixel values are only allowed for genuinely optical measurements, and carry a comment saying so.</p>
      <ul className="fnd-rows">
        {SPACING.map((name) => (
          <li key={name}>
            <code>{name}</code>
            <span className="fnd-bar" style={{ width: `var(${name})` }} />
            <b>{values[name]}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RadiusSheet() {
  const { values, probe } = useTokens(RADIUS);
  return (
    <div className="fnd">
      {probe}
      <h2>Radius</h2>
      <div className="fnd-grid">
        {RADIUS.map((name) => (
          <div key={name} className="fnd-swatch">
            <span className="fnd-radius" style={{ borderRadius: `var(${name})` }} />
            <code>{name}</code>
            <b>{values[name]}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeSheet() {
  const { values, probe } = useTokens(TYPE.flatMap((row) => [row.size, row.lh]));
  return (
    <div className="fnd">
      {probe}
      <h2>Type</h2>
      <p>Sizes follow a ratio; line-heights land on the 4px grid so text blocks stack in rhythm with the spacing scale. Six sizes replaced the eighteen that were here before.</p>
      {TYPE.map((row) => (
        <div key={row.size} className="fnd-type">
          <div style={{ fontSize: `var(${row.size})`, lineHeight: `var(${row.lh})` }}>
            {row.label} — the quick brown fox
          </div>
          <small>
            <code>{row.size}</code> {values[row.size]} / {values[row.lh]} · {row.usage}
          </small>
        </div>
      ))}
    </div>
  );
}

function PaletteSheet() {
  const { values, probe } = useTokens(PALETTE);
  const activity = useTokens(ACTIVITIES, "planner");
  return (
    <div className="fnd">
      {probe}
      {activity.probe}
      <h2>Palette</h2>
      <div className="fnd-grid">
        {PALETTE.map((name) => (
          <div key={name} className="fnd-swatch">
            {/* Painted from the resolved value, not var(): the activity hues
                below are scoped to `.planner` and would not resolve here. */}
            <span className="fnd-chip" style={{ background: values[name] }} />
            <code>{name.replace("--journey-color-", "").replace("--tone-", "tone/")}</code>
            <b>{values[name]}</b>
          </div>
        ))}
      </div>

      <h2>Activity hues</h2>
      <p>Scoped to <code>.planner</code>, drawn from the world art: night violet, lantern ochre, lake teal, rose, sap green. Every painted hour also carries a letter stamp, so the week never reads by colour alone.</p>
      <div className="fnd-grid">
        {ACTIVITIES.map((name) => (
          <div key={name} className="fnd-swatch">
            <span className="fnd-chip" style={{ background: activity.values[name] }} />
            <code>{name.replace("--act-", "")}</code>
            <b>{activity.values[name]}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

const SPRITES = [
  { file: "corner-scroll.png", size: "43×60", role: "Frame corner. One file, mirrored with scaleX/scaleY for the other three." },
  { file: "corner-leaf.png", size: "59×50", role: "Lighter corner for inner panels." },
  { file: "rule-long.png", size: "216×27", role: "Section divider. Tiles horizontally via border-image." },
  { file: "ornament-gem.png", size: "130×81", role: "Heading flourish. Currently unused — it read as a smudge at heading scale." },
  { file: "badge-crest.png", size: "93×103", role: "Age medallion. The year sets into the clear field below the crown." },
];

function SpriteSheet() {
  return (
    <div className="fnd">
      <h2>Interface chrome</h2>
      <p>
        Cut from <code>finished/ChatGPT Image Jul 20, 2026, 10_15_52 AM.png</code> with deterministic ImageMagick crops and
        corner flood-fill at 12% fuzz — no generative redraw, so the original line work survives. Crop boxes are recorded in
        <code> public/decision-signs/ui/EXTRACTION.md</code>.
      </p>
      <div className="fnd-sprites">
        {SPRITES.map((sprite) => (
          <figure key={sprite.file}>
            <div><img src={`/decision-signs/ui/${sprite.file}`} alt={sprite.file} /></div>
            <figcaption>
              <code>{sprite.file}</code>
              <b>{sprite.size}</b>
              <small>{sprite.role}</small>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Foundations/Design tokens",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spacing: Story = { render: () => <SpacingSheet /> };
export const Radius: Story = { render: () => <RadiusSheet /> };
export const Type: Story = { render: () => <TypeSheet /> };
export const Palette: Story = { render: () => <PaletteSheet /> };
export const InterfaceChrome: Story = { render: () => <SpriteSheet /> };
