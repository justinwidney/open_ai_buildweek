import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lifeGraph2026 } from "@control-ai/engine";
import { CAREER_CHOICES } from "../src/labs/decision-travel/decisionCatalog.ts";
import {
  filterAndSortDecisionDeck,
  getDecisionDeckPage,
  mapDecisionBranchesToDeck,
  shuffleDecisionDeck,
} from "../src/labs/decision-travel/decisionDeckModel.ts";

const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
const entryTrack = lifeGraph2026.nodes.find((node) => node.id === "entry-track");
assert.ok(entryTrack, "entry-track must exist in the life graph");
assert.equal(CAREER_CHOICES.length, 20, "career catalog must contain 20 cards");
assert.equal(new Set(CAREER_CHOICES.map(({ id }) => id)).size, 20, "career ids must be unique");

for (const career of CAREER_CHOICES) {
  assert.equal(career.kind, "career");
  assert.ok(career.artwork?.src, `${career.id} needs artwork`);
  assert.ok(existsSync(`${publicRoot}${career.artwork.src.replaceAll("/", "\\")}`), `${career.id} artwork must exist`);
  assert.ok(career.startupSummary, `${career.id} needs commitment-card copy`);
  assert.ok(career.startupItems?.length, `${career.id} needs itemized startup costs`);
  assert.equal(career.startupItems?.reduce((total, item) => total + item.amount, 0), career.cost, `${career.id} cost items must match its total`);
}

const deck = mapDecisionBranchesToDeck(entryTrack.branches, CAREER_CHOICES);
assert.equal(deck.length, 20, "every career branch must enter the card deck");
assert.deepEqual(deck.map(({ details }) => details.id), CAREER_CHOICES.map(({ id }) => id));

for (const pageSize of [5, 3] as const) {
  const pages = Array.from({ length: Math.ceil(deck.length / pageSize) }, (_, pageIndex) => getDecisionDeckPage(deck, pageIndex, pageSize));
  const ids = pages.flatMap(({ items }) => items.map(({ details }) => details.id));
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20, `${pageSize}-card paging must cover every career exactly once`);
}

assert.ok(filterAndSortDecisionDeck(deck, { query: "customer service" }).length > 0, "job skill search must match catalog tags and descriptions");
assert.ok(filterAndSortDecisionDeck(deck, { category: "Technology" }).every(({ details }) => details.category === "Technology"));
const shuffled = shuffleDecisionDeck(deck, () => 0);
assert.notDeepEqual(shuffled.map(({ details }) => details.id), deck.map(({ details }) => details.id));
assert.equal(new Set(shuffled.map(({ details }) => details.id)).size, 20);

console.log("Career deck: 20 illustrated jobs; search/filter/sort, 5/3 paging, shuffle, and Three.js payloads pass.");
