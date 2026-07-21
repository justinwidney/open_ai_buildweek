import type { DecisionChoiceDetails } from "./decisionCatalog";

export type DeckSort = "featured" | "salary" | "cost" | "difficulty" | "title" | "category";

export interface DeckBranchLike {
  id: string;
  label: string;
  description: string;
}

export interface DecisionDeckItem<
  Branch extends DeckBranchLike = DeckBranchLike,
  Details extends DecisionChoiceDetails = DecisionChoiceDetails,
> {
  branch: Branch;
  details: Details;
}

export interface DecisionDeckQuery {
  query?: string;
  category?: string;
  sort?: DeckSort;
}

export interface DecisionDeckPage<Item> {
  items: readonly Item[];
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
}

/** Converts engine branch ids such as `switch-data-science` to catalog ids. */
export function normalizeDeckChoiceId(branchId: string): string {
  return branchId.replace(/^switch-/, "");
}

/**
 * Joins engine branches to their illustrated catalog entries while preserving
 * the original branch and details objects used by the commitment-card payload.
 * Non-card branches (for example, "keep my major") are deliberately omitted.
 */
export function mapDecisionBranchesToDeck<
  Branch extends DeckBranchLike,
  Details extends DecisionChoiceDetails,
>(branches: readonly Branch[], catalog: readonly Details[]): readonly DecisionDeckItem<Branch, Details>[] {
  const detailsById = new Map(catalog.map((details) => [details.id, details] as const));
  return branches.flatMap((branch) => {
    const details = detailsById.get(normalizeDeckChoiceId(branch.id));
    return details ? [{ branch, details }] : [];
  });
}

export function filterAndSortDecisionDeck<Item extends DecisionDeckItem>(
  items: readonly Item[],
  options: DecisionDeckQuery = {},
): readonly Item[] {
  const query = options.query?.trim().toLocaleLowerCase() ?? "";
  const category = options.category ?? "All";
  const sort = options.sort ?? "featured";
  const filtered = items.filter(({ branch, details }) => {
    if (category !== "All" && details.category !== category) return false;
    if (!query) return true;
    const haystack = [
      branch.label,
      branch.description,
      details.category,
      details.outlook,
      details.note,
      details.costLabel,
      details.timeLabel,
      details.housingLabel ?? "",
      details.commitmentLabel ?? "",
      ...details.tags,
    ].join(" ").toLocaleLowerCase();
    return haystack.includes(query);
  });

  return filtered
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      let comparison = 0;
      if (sort === "salary") comparison = b.item.details.startingSalary - a.item.details.startingSalary;
      if (sort === "cost") comparison = a.item.details.cost - b.item.details.cost;
      if (sort === "difficulty") comparison = a.item.details.difficulty - b.item.details.difficulty;
      if (sort === "title") comparison = a.item.branch.label.localeCompare(b.item.branch.label);
      if (sort === "category") {
        comparison = a.item.details.category.localeCompare(b.item.details.category)
          || a.item.branch.label.localeCompare(b.item.branch.label);
      }
      return comparison || a.originalIndex - b.originalIndex;
    })
    .map(({ item }) => item);
}

export function getDecisionDeckPage<Item>(
  items: readonly Item[],
  requestedPageIndex: number,
  pageSize: number,
): DecisionDeckPage<Item> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("pageSize must be a positive integer");
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safeRequestedPage = Number.isFinite(requestedPageIndex) ? Math.trunc(requestedPageIndex) : 0;
  const pageIndex = Math.min(Math.max(0, safeRequestedPage), pageCount - 1);
  const startIndex = pageIndex * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);
  return {
    items: items.slice(startIndex, endIndex),
    pageIndex,
    pageSize,
    pageCount,
    totalItems: items.length,
    startIndex,
    endIndex,
  };
}

/** Fisher-Yates shuffle. An injectable RNG keeps catalog validation deterministic. */
export function shuffleDecisionDeck<Item>(items: readonly Item[], random: () => number = Math.random): readonly Item[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = random();
    const boundedSample = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 1 - Number.EPSILON) : 0;
    const swapIndex = Math.floor(boundedSample * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}
