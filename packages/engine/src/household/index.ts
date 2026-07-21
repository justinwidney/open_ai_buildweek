export type { Person, Dependent, DependentKind, Household } from "./types.js";
export {
  ageYearsAt,
  primaryPerson,
  dependentsUnderAge,
  qualifyingChildrenForCtc,
  childTaxCreditCents,
  householdContextAt,
  type ChildTaxCreditOptions,
  type HouseholdContext,
} from "./compute.js";
