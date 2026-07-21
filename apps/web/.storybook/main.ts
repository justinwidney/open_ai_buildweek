import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // This is a private product repo; don't phone home on every dev start.
  core: { disableTelemetry: true },
  // The journey surfaces reference sprites by absolute path (/decision-signs/…,
  // /lab-assets/…), so public/ has to be served as-is.
  staticDirs: ["../public"],
  typescript: {
    // The app already gates types through `tsc -b`; re-running the checker in
    // Storybook only slows the dev loop down.
    check: false,
  },
};

export default config;
