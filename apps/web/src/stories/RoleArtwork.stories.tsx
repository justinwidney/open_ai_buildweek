import type { Meta, StoryObj } from "@storybook/react-vite";
import { CAREER_CHOICES, MAJOR_CHOICES, PET_CHOICES, type DecisionChoiceDetails } from "../labs/decision-travel/decisionCatalog";
import "./foundations.css";

/**
 * Every illustration in the deck, resolved through the same
 * `/role-cards/{roles|majors|pets}/{id}.svg` path the catalog builds. A missing file
 * shows here as a broken tile rather than as a suspended card at runtime.
 */
function Gallery({ rows, caption }: { rows: readonly DecisionChoiceDetails[]; caption: string }) {
  return (
    <div className="fnd">
      <h2>{caption}</h2>
      <p>
        {rows.length} illustrations. The card resolves artwork from the catalog id, so adding a row without dropping a
        matching SVG into <code>public/role-cards/</code> leaves a gap you can see here.
      </p>
      <div className="art-grid">
        {rows.map((row) => (
          <figure key={row.id}>
            <div className="art-tile">
              <img src={row.artwork?.src} alt="" loading="lazy" />
            </div>
            <figcaption>
              <strong>{row.id.replaceAll("-", " ")}</strong>
              <small>{row.category} · {row.outlook}</small>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Cards/Artwork library",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const StarterRoles: Story = {
  render: () => <Gallery rows={CAREER_CHOICES} caption="Starter roles" />,
};

export const CollegeMajors: Story = {
  render: () => <Gallery rows={MAJOR_CHOICES} caption="College majors" />,
};

export const PetCompanions: Story = {
  render: () => <Gallery rows={PET_CHOICES} caption="Pet companions" />,
};
