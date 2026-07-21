import type { PayCadence } from "@control-ai/shared/life-sim";

export const ONBOARDING_PROFILE_STORAGE_KEY = "control-ai:onboarding-profile:v1";

export type EducationLevel =
  | "high-school"
  | "trade-certificate"
  | "college-diploma"
  | "bachelors"
  | "graduate"
  | "other";

export type CommunityType = "rural" | "small-town" | "mid-size-city" | "large-city";
export type CompensationBasis = "hourly" | "salary" | "contract" | "self-employed";
export type WorkScheduleKind = "standard" | "part-time" | "shift" | "rotation-7-7" | "rotation-10-4" | "variable";

export interface OnboardingDemographics {
  age: number;
  countryCode: string;
  location: string;
  communityType: CommunityType;
  educationLevel: EducationLevel;
  fieldOfStudy: string | null;
}

export interface OnboardingWorkExperience {
  hasPriorExperience: boolean;
  occupationId: string | null;
  occupationTitle: string | null;
  yearsExperience: number;
  compensationBasis: CompensationBasis | null;
  payCadence: PayCadence | null;
  scheduleKind: WorkScheduleKind | null;
  /** Used with an hourly rate to normalize the legacy monthly simulation input. */
  averageHoursPerWeek: number | null;
  /** Populated only for hourly compensation. */
  grossHourlyRateCents: number | null;
  /** Populated only for non-hourly compensation; cadence defines the period. */
  grossPayPerPeriodCents: number | null;
  hasBonusOrCommission: boolean;
  notes: string | null;
}

/** Versioned payload handed from onboarding to journey and simulation setup. */
export interface JourneyOnboardingProfile {
  schemaVersion: 1;
  completedAt: string;
  /** Current net worth in whole dollars, used to anchor month zero. */
  startingNetWorth?: number;
  demographics: OnboardingDemographics;
  workExperience: OnboardingWorkExperience;
}
