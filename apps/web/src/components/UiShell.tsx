/**
 * Stable integration surface for the overlay UI. The canvas/world is passed as
 * children so this package stays independent of the Three.js implementation.
 */
export { AppShell as UiShell } from "./AppShell";
export type { AppShellProps as UiShellProps, ShellTool, SkillPanelData } from "./AppShell";
