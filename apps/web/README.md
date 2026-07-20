# Web UI shell

`UiShell` is a responsive, full-screen React overlay for the world canvas. Supply the Three.js/R3F canvas as `children`; it is deliberately independent from the scene and engine layers.

```tsx
import { UiShell } from "./components";

export function App() {
  return <UiShell onPromptSubmit={(prompt) => console.log(prompt)}><WorldCanvas /></UiShell>;
}
```

The component needs React 18+ and a global app entry that imports it. Its own stylesheet is imported by the component; no image or icon dependency is needed for the MVP.
