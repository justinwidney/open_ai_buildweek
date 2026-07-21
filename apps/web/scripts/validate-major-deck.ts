import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lifeGraph2026 } from "@control-ai/engine";
import { MAJOR_CHOICES } from "../src/labs/decision-travel/decisionCatalog.ts";
import {
  filterAndSortDecisionDeck,
  getDecisionDeckPage,
  mapDecisionBranchesToDeck,
  normalizeDeckChoiceId,
  shuffleDecisionDeck,
} from "../src/labs/decision-travel/decisionDeckModel.ts";

const EXPECTED_MAJOR_IDS = [
  "nursing",
  "computer-science",
  "business",
  "liberal-arts",
  "accounting",
  "mechanical-engineering",
  "education",
  "psychology",
  "biology",
  "communications",
  "criminal-justice",
  "economics",
  "graphic-design",
  "cybersecurity",
  "data-science",
  "social-work",
  "public-health",
  "finance",
  "environmental-science",
  "hospitality",
] as const;

const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
const declareMajor = lifeGraph2026.nodes.find((node) => node.id === "declare-major");
const swapMajor = lifeGraph2026.nodes.find((node) => node.id === "swap-major");
assert.ok(declareMajor, "declare-major must exist in the life graph");
assert.ok(swapMajor, "swap-major must exist in the life graph");

assert.deepEqual(MAJOR_CHOICES.map(({ id }) => id), EXPECTED_MAJOR_IDS, "catalog order should stay deliberate and complete");
assert.equal(new Set(MAJOR_CHOICES.map(({ id }) => id)).size, 20, "major catalog ids must be unique");

for (const major of MAJOR_CHOICES) {
  assert.equal(major.kind, "major");
  assert.ok(major.artwork?.src, `${major.id} needs illustrated card artwork`);
  assert.ok(major.startupSummary, `${major.id} needs commitment-card explanatory copy`);
  assert.ok(major.startupItems?.length, `${major.id} needs an itemized commitment breakdown`);
  assert.equal(
    major.startupItems?.reduce((total, item) => total + item.amount, 0),
    major.cost,
    `${major.id} itemized program costs must match its catalog total`,
  );

  const artworkPath = `${publicRoot}${major.artwork.src.replaceAll("/", "\\")}`;
  assert.ok(existsSync(artworkPath), `${major.id} artwork must exist at ${major.artwork.src}`);
  const svg = readFileSync(artworkPath, "utf8");
  assert.match(svg, /<svg[^>]*width="280"[^>]*height="280"[^>]*viewBox="0 0 280 280"/, `${major.id} SVG must expose the card texture dimensions`);
}

const declareDeck = mapDecisionBranchesToDeck(declareMajor.branches, MAJOR_CHOICES);
const swapDeck = mapDecisionBranchesToDeck(swapMajor.branches, MAJOR_CHOICES);
assert.equal(declareDeck.length, 20, "every declare-major branch must enter the card deck");
assert.equal(swapDeck.length, 20, "every illustrated switch-major branch must enter the card deck");
assert.deepEqual(declareDeck.map(({ details }) => details.id), EXPECTED_MAJOR_IDS);
assert.deepEqual(swapDeck.map(({ details }) => details.id), EXPECTED_MAJOR_IDS);
assert.ok(!swapDeck.some(({ branch }) => branch.id === "decline"), "the non-card keep-major branch must remain outside the deck");

for (const item of swapDeck) {
  assert.equal(item.details.id, normalizeDeckChoiceId(item.branch.id));
  assert.match(item.branch.id, /^switch-/);
  assert.strictEqual(item.details, MAJOR_CHOICES.find(({ id }) => id === item.details.id), "deck selection must retain the exact Three.js details payload");
}
assert.equal(normalizeDeckChoiceId("switch-data-science"), "data-science");
assert.equal(normalizeDeckChoiceId("computer-science"), "computer-science");

function assertCompletePagination(pageSize: 3 | 5) {
  const pages = Array.from(
    { length: Math.ceil(declareDeck.length / pageSize) },
    (_, pageIndex) => getDecisionDeckPage(declareDeck, pageIndex, pageSize),
  );
  const ids = pages.flatMap((page) => page.items.map(({ details }) => details.id));
  assert.deepEqual(ids, EXPECTED_MAJOR_IDS, `${pageSize}-card paging must cover every major once and in order`);
  assert.equal(new Set(ids).size, 20, `${pageSize}-card paging must not duplicate a major`);
  return pages;
}

const widePages = assertCompletePagination(5);
assert.equal(widePages.length, 4);
assert.deepEqual(widePages.map(({ startIndex, endIndex }) => [startIndex, endIndex]), [[0, 5], [5, 10], [10, 15], [15, 20]]);
assert.ok(widePages.every(({ items }) => items.length === 5));

const narrowPages = assertCompletePagination(3);
assert.equal(narrowPages.length, 7);
assert.deepEqual(narrowPages.map(({ startIndex, endIndex }) => [startIndex, endIndex]), [[0, 3], [3, 6], [6, 9], [9, 12], [12, 15], [15, 18], [18, 20]]);
assert.equal(narrowPages.at(-1)?.items.length, 2);
assert.equal(getDecisionDeckPage(declareDeck, 99, 5).pageIndex, 3, "out-of-range next navigation must clamp to the final page");
assert.equal(getDecisionDeckPage(declareDeck, -2, 5).pageIndex, 0, "out-of-range previous navigation must clamp to the first page");

const technology = filterAndSortDecisionDeck(declareDeck, { category: "Technology" });
assert.deepEqual(technology.map(({ details }) => details.id), ["computer-science", "cybersecurity", "data-science"]);
const codingSearch = filterAndSortDecisionDeck(declareDeck, { query: "coding" });
assert.deepEqual(codingSearch.map(({ details }) => details.id), ["computer-science", "data-science"]);
const sortedByCost = filterAndSortDecisionDeck(declareDeck, { sort: "cost" });
assert.ok(sortedByCost.every((item, index) => index === 0 || sortedByCost[index - 1]!.details.cost <= item.details.cost));
const sortedBySalary = filterAndSortDecisionDeck(declareDeck, { sort: "salary" });
assert.ok(sortedBySalary.every((item, index) => index === 0 || sortedBySalary[index - 1]!.details.startingSalary >= item.details.startingSalary));
const sortedByDifficulty = filterAndSortDecisionDeck(declareDeck, { sort: "difficulty" });
assert.ok(sortedByDifficulty.every((item, index) => index === 0 || sortedByDifficulty[index - 1]!.details.difficulty <= item.details.difficulty));
const sortedByTitle = filterAndSortDecisionDeck(declareDeck, { sort: "title" });
assert.deepEqual(sortedByTitle.map(({ branch }) => branch.label), [...sortedByTitle].map(({ branch }) => branch.label).sort((a, b) => a.localeCompare(b)));
const sortedByCategory = filterAndSortDecisionDeck(declareDeck, { sort: "category" });
assert.deepEqual(
  sortedByCategory.map(({ branch, details }) => `${details.category}\0${branch.label}`),
  [...sortedByCategory].map(({ branch, details }) => `${details.category}\0${branch.label}`).sort((a, b) => a.localeCompare(b)),
  "category sorting should group fields and alphabetize cards within each group",
);

const shuffled = shuffleDecisionDeck(declareDeck, () => 0);
assert.notDeepEqual(shuffled.map(({ details }) => details.id), EXPECTED_MAJOR_IDS, "shuffle should visibly randomize the deck order");
assert.deepEqual(
  [...shuffled.map(({ details }) => details.id)].sort(),
  [...EXPECTED_MAJOR_IDS].sort(),
  "shuffle must retain every major exactly once",
);
for (const pageSize of [5, 3] as const) {
  const shuffledPages = Array.from(
    { length: Math.ceil(shuffled.length / pageSize) },
    (_, pageIndex) => getDecisionDeckPage(shuffled, pageIndex, pageSize),
  );
  assert.equal(new Set(shuffledPages.flatMap(({ items }) => items.map(({ details }) => details.id))).size, 20);
}

const selected = swapDeck.find(({ branch }) => branch.id === "switch-data-science");
assert.ok(selected, "switch-data-science must be selectable");
assert.deepEqual(
  {
    artworkSrc: selected.details.artwork?.src,
    title: selected.branch.label,
    category: selected.details.category,
    outlook: selected.details.outlook,
    note: selected.details.note,
    startupSummary: selected.details.startupSummary,
    startupItems: selected.details.startupItems,
    cost: selected.details.cost,
    timeLabel: selected.details.timeLabel,
    startingSalary: selected.details.startingSalary,
  },
  {
    artworkSrc: "/role-cards/majors/data-science.svg",
    title: "Switch to Data Science",
    category: "Technology",
    outlook: "Fast growing",
    note: "A high-intensity blend of statistics, programming, and domain problem solving.",
    startupSummary: selected.details.startupSummary,
    startupItems: selected.details.startupItems,
    cost: 82_000,
    timeLabel: "4 years",
    startingSalary: 98_400,
  },
  "a clicked switch-major card must pass the correct content into Three.js",
);

console.log("Major deck: 20 illustrated declare + switch options; search/filter/sort, 5/3 paging, shuffle, normalization, and Three.js payload all pass.");
