import type { MonthKey } from "../types/month.js";

export const LIFE_PROFILE_SCHEMA_VERSION = 1 as const;

export type EducationStatus = "none" | "enrolled" | "paused" | "completed";
export type WorkStatus = "not-working" | "part-time" | "full-time" | "self-employed" | "service";
export type RelationshipStatus = "single" | "partnered" | "married" | "separated" | "divorced" | "widowed";
export type HousingTenure = "family" | "campus" | "provided" | "shared-rent" | "partner-rent" | "solo-rent" | "owner" | "unhoused";

export interface EducationProfile {
  status: EducationStatus;
  programId?: string;
  credentials: readonly string[];
}

export interface WorkProfile {
  status: WorkStatus;
  occupationId?: string;
  weeklyHours: number;
}

export interface HouseholdProfile {
  relationshipStatus: RelationshipStatus;
  dependents: number;
  weeklyCareHours: number;
}

export interface PlaceProfile {
  locationPattern: string;
  housingTenure: HousingTenure;
  commuteMode: string;
  monthlyLivingCostDollars: number;
}

export interface WeeklyTimeBudget {
  work: number;
  study: number;
  sleep: number;
  friends: number;
  fitness: number;
  transit: number;
  flexible: number;
}

export interface WellbeingProfile {
  stress: number;
  socialSupport: number;
  burnoutRisk: number;
}

export interface LifeGoal {
  id: string;
  label: string;
  domain: string;
  reviewMonth: MonthKey;
  status: "active" | "completed" | "paused";
}

/** Versioned, typed life state. Flags remain available only as a migration/extension layer. */
export interface LifeProfileState {
  schemaVersion: typeof LIFE_PROFILE_SCHEMA_VERSION;
  education: EducationProfile;
  work: WorkProfile;
  household: HouseholdProfile;
  place: PlaceProfile;
  time: WeeklyTimeBudget;
  wellbeing: WellbeingProfile;
  goals: readonly LifeGoal[];
}

export function initialLifeProfile(): LifeProfileState {
  return {
    schemaVersion: LIFE_PROFILE_SCHEMA_VERSION,
    education: { status: "none", credentials: [] },
    work: { status: "part-time", weeklyHours: 16 },
    household: { relationshipStatus: "single", dependents: 0, weeklyCareHours: 0 },
    place: { locationPattern: "family-home", housingTenure: "family", commuteMode: "transit", monthlyLivingCostDollars: 1_400 },
    time: { work: 16, study: 0, sleep: 56, friends: 12, fitness: 5, transit: 5, flexible: 74 },
    wellbeing: { stress: 35, socialSupport: 65, burnoutRisk: 20 },
    goals: [],
  };
}

/** Safely upgrades contexts saved before typed life profiles were introduced. */
export function normalizeLifeProfile(value: LifeProfileState | undefined): LifeProfileState {
  if (!value || value.schemaVersion !== LIFE_PROFILE_SCHEMA_VERSION) return initialLifeProfile();
  return value;
}
