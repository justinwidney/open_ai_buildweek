import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        labs: resolve(__dirname, "labs/index.html"),
        "platform-art": resolve(__dirname, "labs/platform-art.html"),
        "rotation-rig": resolve(__dirname, "labs/rotation-rig.html"),
        "travel-rig": resolve(__dirname, "labs/travel-rig.html"),
        "background-pan": resolve(__dirname, "labs/background-pan.html"),
        "floater-sprites": resolve(__dirname, "labs/floater-sprites.html"),
        "platform-view": resolve(__dirname, "labs/platform-view.html"),
      },
    },
  },
});
