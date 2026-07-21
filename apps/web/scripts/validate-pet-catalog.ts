import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lifeGraph2026 } from "@control-ai/engine";
import { PET_CHOICES } from "../src/labs/decision-travel/decisionCatalog.ts";
import {
  filterAndSortDecisionDeck,
  getDecisionDeckPage,
  mapDecisionBranchesToDeck,
  shuffleDecisionDeck,
} from "../src/labs/decision-travel/decisionDeckModel.ts";

const publicRoot = fileURLToPath(new URL("../public", import.meta.url));
const petNode = lifeGraph2026.nodes.find((node) => node.id === "rng-pet");

assert.ok(petNode, "the engine must expose the rng-pet decision");

const deck = mapDecisionBranchesToDeck(petNode.branches, PET_CHOICES);
const deckIds = deck.map(({ details }) => details.id);
const expectedPetIds = PET_CHOICES.map(({ id }) => id);

assert.equal(PET_CHOICES.length, 12, "the pet explorer should expose all 12 illustrated choices");
assert.equal(new Set(PET_CHOICES.map((pet) => pet.id)).size, PET_CHOICES.length, "pet ids must be unique");
assert.deepEqual(deckIds, expectedPetIds, "every illustrated pet branch should map into the deck in engine order");
assert.equal(new Set(deckIds).size, PET_CHOICES.length, "the pet deck must not contain duplicates");

const declineBranch = petNode.branches.find(({ id }) => id === "decline");
assert.ok(declineBranch, "the engine must retain a Not now branch");
assert.equal(declineBranch.label, "Not now");
assert.ok(!deck.some(({ branch }) => branch.id === "decline"), "Not now belongs outside the illustrated deck");

for (const pet of PET_CHOICES) {
  assert.ok(pet.monthlyCost && pet.monthlyCost > 0, `${pet.id} needs an ongoing monthly cost`);
  assert.ok(pet.weeklyHours && pet.weeklyHours > 0, `${pet.id} needs a weekly care estimate`);
  assert.equal(
    pet.startupItems?.reduce((sum, item) => sum + item.amount, 0),
    pet.cost,
    `${pet.id} itemized setup costs must match its catalog total`,
  );

  assert.ok(pet.artwork?.src, `${pet.id} needs artwork`);
  const artworkPath = `${publicRoot}${pet.artwork!.src.replaceAll("/", "\\")}`;
  assert.ok(existsSync(artworkPath), `${pet.id} artwork must exist`);
  const svg = readFileSync(artworkPath, "utf8");
  assert.match(svg, /<svg[^>]*width="280"[^>]*height="280"[^>]*viewBox="0 0 280 280"/);
}

for (const { branch, details } of deck) {
  assert.equal(branch.inputs?.upfrontDollars, details.cost, `${details.id} setup cost must match the engine rule`);
  assert.equal(branch.inputs?.monthlyDollars, details.monthlyCost, `${details.id} monthly cost must match the engine rule`);
  assert.equal(branch.inputs?.weeklyCareHours, details.weeklyHours, `${details.id} weekly care must match the engine rule`);
  assert.equal(branch.inputs?.commitment, details.commitmentLabel, `${details.id} lifespan must match the engine rule`);
  assert.equal(branch.tradeoffs?.upfrontDollars, -details.cost, `${details.id} rule must debit the advertised setup cost`);
  assert.equal(branch.tradeoffs?.monthlyCashFlowDollars, -(details.monthlyCost ?? 0), `${details.id} rule must debit the advertised monthly cost`);
  assert.equal(branch.tradeoffs?.weeklyHoursDelta, -(details.weeklyHours ?? 0), `${details.id} rule must reserve the advertised care time`);
}

assert.deepEqual(
  filterAndSortDecisionDeck(deck, { query: "renter-friendly" }).map(({ details }) => details.id),
  ["adult-cat"],
  "tag search should find renter-friendly pets",
);
assert.deepEqual(
  filterAndSortDecisionDeck(deck, { query: "reliable power" }).map(({ details }) => details.id),
  ["leopard-gecko"],
  "housing search should find pets whose home setup matches the query",
);
assert.deepEqual(
  filterAndSortDecisionDeck(deck, { query: "low care" }).map(({ details }) => details.id),
  ["hamster"],
  "care-level search should include the catalog outlook",
);
assert.deepEqual(
  filterAndSortDecisionDeck(deck, { category: "Reptiles" }).map(({ details }) => details.id),
  ["leopard-gecko", "tortoise"],
  "category filtering should isolate the requested pet family",
);

const expectedCategoryOrder = [...deck]
  .sort((a, b) => a.details.category.localeCompare(b.details.category) || a.branch.label.localeCompare(b.branch.label))
  .map(({ details }) => details.id);
assert.deepEqual(
  filterAndSortDecisionDeck(deck, { sort: "category" }).map(({ details }) => details.id),
  expectedCategoryOrder,
  "category sorting should group pet families and alphabetize within them",
);
assert.deepEqual(
  filterAndSortDecisionDeck(deck, { sort: "cost" }).map(({ details }) => details.cost),
  [...PET_CHOICES].map(({ cost }) => cost).sort((a, b) => a - b),
  "cost sorting should order setup estimates from lowest to highest",
);
assert.deepEqual(
  filterAndSortDecisionDeck(deck, { sort: "difficulty" }).map(({ details }) => details.difficulty),
  [...PET_CHOICES].map(({ difficulty }) => difficulty).sort((a, b) => a - b),
  "difficulty sorting should order care complexity from lowest to highest",
);

const widePages = [0, 1, 2].map((pageIndex) => getDecisionDeckPage(deck, pageIndex, 5));
assert.deepEqual(widePages.map(({ items }) => items.length), [5, 5, 2], "wide decks should show 5 cards per page");
assert.deepEqual(widePages[0]?.items.map(({ details }) => details.id), expectedPetIds.slice(0, 5));
assert.deepEqual(widePages[2]?.items.map(({ details }) => details.id), expectedPetIds.slice(10, 12));
assert.equal(getDecisionDeckPage(deck, -4, 5).pageIndex, 0, "paging should clamp before the first page");
assert.equal(getDecisionDeckPage(deck, 99, 5).pageIndex, 2, "paging should clamp after the last wide page");

const narrowPages = [0, 1, 2, 3].map((pageIndex) => getDecisionDeckPage(deck, pageIndex, 3));
assert.deepEqual(narrowPages.map(({ items }) => items.length), [3, 3, 3, 3], "narrow decks should show 3 cards per page");
assert.deepEqual(narrowPages[3]?.items.map(({ details }) => details.id), expectedPetIds.slice(9, 12));
assert.equal(getDecisionDeckPage(deck, 99, 3).pageIndex, 3, "paging should clamp after the last narrow page");

let randomState = 0x5eed1234;
const deterministicRandom = () => {
  randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
  return randomState / 0x1_0000_0000;
};
const shuffled = shuffleDecisionDeck(deck, deterministicRandom);
assert.equal(shuffled.length, deck.length, "shuffle must preserve deck length");
assert.deepEqual([...shuffled.map(({ details }) => details.id)].sort(), [...expectedPetIds].sort(), "shuffle must preserve every unique pet");
assert.notDeepEqual(shuffled.map(({ details }) => details.id), expectedPetIds, "shuffle should change the visible order");
assert.deepEqual(deck.map(({ details }) => details.id), expectedPetIds, "shuffle must not mutate catalog order");

const selected = deck.find(({ details }) => details.id === "tortoise");
assert.ok(selected, "a deck card must retain the selected catalog payload");
assert.equal(selected.details.monthlyCost, 70);
assert.equal(selected.details.weeklyHours, 4);
assert.equal(selected.details.housingLabel, "Long-term room for a large climate-controlled habitat");
assert.equal(selected.details.commitmentLabel, "40+ years");
assert.equal(selected.details.artwork?.src, "/role-cards/pets/tortoise.svg");
assert.equal(selected.details, PET_CHOICES.find(({ id }) => id === "tortoise"), "selection must preserve the exact Three.js detail-card data object");

console.log("Pet deck: 12 illustrated options plus external decline; search, filters, sorts, 5/3 paging, shuffle, detail payloads, costs, care fields, and SVG assets all match.");
