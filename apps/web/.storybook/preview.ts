import type { Preview } from "@storybook/react-vite";

// Loaded once for every story: the app reset, the shared token layer, and the
// decision-travel chrome that the popup and road signs style themselves from.
import "../src/styles.css";
import "../src/journey.tokens.css";
import "../src/labs/lab.css";
import "../src/labs/decision-travel/theme.css";
import "../src/labs/decision-travel/panels.css";
import "../src/labs/decision-travel/DecisionExperience.css";

const preview: Preview = {
  parameters: {
    // Nearly every surface here is a full-bleed overlay or a fixed layer, so
    // padding from the default layout would be misleading.
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { test: "todo" },
    options: {
      storySort: {
        order: ["Foundations", "Year planner", "Decisions", "*"],
      },
    },
  },
};

export default preview;
