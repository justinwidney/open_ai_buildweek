import type { EffectivePeriod, JsonPrimitive, SourceProvenance, StableId, VersionId, VersionedReference } from "./values.js";

export const CATALOG_FILTER_OPERATORS = ["eq", "one-of", "contains", "gte", "lte"] as const;
export type CatalogFilterOperator = (typeof CATALOG_FILTER_OPERATORS)[number];

export interface CatalogFacetFilter {
  field: string;
  operator: CatalogFilterOperator;
  value: JsonPrimitive | readonly JsonPrimitive[];
}

export interface CatalogSort {
  field: string;
  direction: "asc" | "desc";
}

export interface CatalogQuery {
  catalog: VersionedReference;
  text?: string;
  locale?: string;
  effectiveAt?: string;
  filters: readonly CatalogFacetFilter[];
  sort: readonly CatalogSort[];
  page: { limit: number; cursor?: string };
}

/** Common fields needed by searchable career, education, and housing tiles. */
export interface CatalogItemSummary {
  id: StableId;
  version: VersionId;
  label: string;
  description?: string;
  aliases: readonly string[];
  tags: readonly string[];
  effectivePeriod?: EffectivePeriod<string>;
  provenance: SourceProvenance;
}

export interface CatalogPage<TItem extends CatalogItemSummary = CatalogItemSummary> {
  catalog: VersionedReference;
  items: readonly TItem[];
  nextCursor?: string;
  total?: number;
  /** Stable key used after requested sorts to make pagination deterministic. */
  tieBreaker: "id";
}
