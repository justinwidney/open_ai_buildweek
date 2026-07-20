import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverDirectory = resolve("dist/server");
await mkdir(serverDirectory, { recursive: true });
await writeFile(
  resolve(serverDirectory, "index.js"),
  `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
  "utf8",
);
