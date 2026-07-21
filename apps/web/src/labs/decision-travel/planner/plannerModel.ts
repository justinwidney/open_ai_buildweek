import type { HousingTenure, LifeContext } from "@control-ai/engine";

/**
 * The year planner is three independent instruments. A year asks for whichever
 * ones it needs: a scripted milestone year may stack all three, while a quiet
 * year offers a single re-evaluation of where you live or how you spend.
 */
export type PlannerStepId = "direction" | "budget" | "timetable";

export const PLANNER_STEP_TITLES: Record<PlannerStepId, string> = {
  direction: "Choose the direction",
  budget: "Balance the budget",
  timetable: "Balance the week",
};

export const LIVING_OPTIONS = [
  { id: "family", label: "With family", housingTenure: "family" as HousingTenure, housing: 450, utilities: 110, moveCost: 250, note: "Best runway, shared rules" },
  { id: "campus", label: "Campus housing", housingTenure: "campus" as HousingTenure, housing: 1_050, utilities: 120, moveCost: 400, note: "Close to daily life, less control" },
  { id: "roommates", label: "With roommates", housingTenure: "shared-rent" as HousingTenure, housing: 825, utilities: 165, moveCost: 900, note: "Shared cost, shared space" },
  { id: "partner", label: "With a partner", housingTenure: "partner-rent" as HousingTenure, housing: 760, utilities: 150, moveCost: 850, note: "Shared home, more coordination" },
  { id: "studio", label: "Studio alone", housingTenure: "solo-rent" as HousingTenure, housing: 1_425, utilities: 190, moveCost: 1_650, note: "Privacy, highest fixed cost" },
] as const;

export const LOCATION_OPTIONS = [
  { id: "campus-core", label: "Campus or work core", monthlyDelta: 280, commute: 2, note: "Walkable and close" },
  { id: "urban", label: "Urban neighborhood", monthlyDelta: 340, commute: 4, note: "Access and variety" },
  { id: "suburban", label: "Suburban", monthlyDelta: 0, commute: 7, note: "More space, longer trips" },
  { id: "small-city", label: "Small city or town", monthlyDelta: -240, commute: 6, note: "Lower costs, fewer options" },
  { id: "remote-region", label: "Rural", monthlyDelta: -330, commute: 9, note: "Lowest costs, travel burden" },
] as const;

export const TRANSIT_OPTIONS = [
  { id: "walk", label: "Walk", monthly: 25, weeklyHours: 3, note: "Low cost, weather exposed" },
  { id: "bike", label: "Bike", monthly: 45, weeklyHours: 3, note: "Fast and active" },
  { id: "transit", label: "Public transit", monthly: 125, weeklyHours: 6, note: "No parking, more waiting" },
  { id: "car", label: "Car", monthly: 575, weeklyHours: 4, note: "Flexible, insurance and repairs" },
  { id: "remote", label: "Mostly remote", monthly: 55, weeklyHours: 1, note: "Time back, less daily contact" },
] as const;

export type LivingOption = (typeof LIVING_OPTIONS)[number];
export type LocationOption = (typeof LOCATION_OPTIONS)[number];
export type TransitOption = (typeof TRANSIT_OPTIONS)[number];

/** Categories the player paints onto the week. Transit is placed by the budget, not painted. */
export type ActivityKey = "sleep" | "work" | "study" | "friends" | "fitness";

export interface ActivityDefinition {
  key: ActivityKey;
  label: string;
  /** Single letter stamped into a painted cell so the grid reads without colour alone. */
  stamp: string;
  guidance: string;
}

export const ACTIVITIES: readonly ActivityDefinition[] = [
  { key: "sleep", label: "Sleep", stamp: "S", guidance: "Most adults need 49 to 63 hours a week." },
  { key: "work", label: "Work", stamp: "W", guidance: "Full time is about 40 hours plus commute." },
  { key: "study", label: "Class and study", stamp: "C", guidance: "A full course load runs 30 to 45 hours." },
  { key: "friends", label: "Friends and family", stamp: "F", guidance: "Relationships need recurring, protected time." },
  { key: "fitness", label: "Health and fitness", stamp: "H", guidance: "Even 3 hours a week changes the decade." },
];

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
export const WEEK_CELLS = DAYS_PER_WEEK * HOURS_PER_DAY;

/** A painted week. `null` is unclaimed time, `"transit"` is reserved by the commute. */
export type WeekCell = ActivityKey | "transit" | null;
export type WeekGrid = readonly WeekCell[];

export const cellIndex = (day: number, hour: number) => day * HOURS_PER_DAY + hour;
export const cellDay = (index: number) => Math.floor(index / HOURS_PER_DAY);
export const cellHour = (index: number) => index % HOURS_PER_DAY;

/** 24-hour clock label for an hour row, e.g. 0 -> "12a", 13 -> "1p". */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "a" : "p";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

export function readableHour(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

/**
 * Place the commute into the week as locked cells so the cost of getting
 * around is visible as time, not just as a line in the budget. Weekday
 * mornings fill first, then weekday evenings.
 */
export function placeTransit(hours: number): number[] {
  const slots: number[] = [];
  const morningHours = [7, 8, 6];
  const eveningHours = [17, 18, 19];
  for (const hour of morningHours) {
    for (let day = 0; day < 5; day += 1) slots.push(cellIndex(day, hour));
  }
  for (const hour of eveningHours) {
    for (let day = 0; day < 5; day += 1) slots.push(cellIndex(day, hour));
  }
  return slots.slice(0, Math.max(0, Math.round(hours)));
}

export function emptyWeek(transitHours: number): WeekCell[] {
  const grid: WeekCell[] = Array.from({ length: WEEK_CELLS }, () => null);
  for (const index of placeTransit(transitHours)) grid[index] = "transit";
  return grid;
}

/**
 * Re-place the commute when the budget changes the transit choice, keeping
 * every activity the player already painted.
 */
export function reflowTransit(grid: WeekGrid, transitHours: number): WeekCell[] {
  const next: WeekCell[] = grid.map((cell) => (cell === "transit" ? null : cell));
  let remaining = Math.max(0, Math.round(transitHours));
  for (const index of placeTransit(transitHours)) {
    if (remaining === 0) break;
    if (next[index] === null) {
      next[index] = "transit";
      remaining -= 1;
    }
  }
  // If the preferred commute slots were painted over, take the first free cell.
  for (let index = 0; index < next.length && remaining > 0; index += 1) {
    if (next[index] === null) {
      next[index] = "transit";
      remaining -= 1;
    }
  }
  return next;
}

/** A seeded starting week so nobody faces 168 blank cells. */
export function suggestedWeek(stage: LifeContext["stage"], transitHours: number): WeekCell[] {
  const grid = emptyWeek(transitHours);
  const paint = (day: number, from: number, to: number, key: ActivityKey) => {
    for (let hour = from; hour < to; hour += 1) {
      const index = cellIndex(day, hour);
      if (grid[index] === null) grid[index] = key;
    }
  };
  const inSchool = stage === "school";
  for (let day = 0; day < 7; day += 1) {
    paint(day, 0, 7, "sleep");
    paint(day, 23, 24, "sleep");
  }
  for (let day = 0; day < 5; day += 1) {
    if (inSchool) {
      paint(day, 9, 15, "study");
      paint(day, 19, 21, "study");
    } else {
      paint(day, 9, 17, "work");
    }
  }
  paint(5, 10, 12, "fitness");
  paint(1, 18, 19, "fitness");
  paint(3, 18, 19, "fitness");
  paint(5, 18, 22, "friends");
  paint(6, 13, 17, "friends");
  return grid;
}

export type ActivityTotals = Record<ActivityKey, number>;

export function tallyWeek(grid: WeekGrid): { activities: ActivityTotals; transit: number; unclaimed: number } {
  const activities: ActivityTotals = { sleep: 0, work: 0, study: 0, friends: 0, fitness: 0 };
  let transit = 0;
  let unclaimed = 0;
  for (const cell of grid) {
    if (cell === null) unclaimed += 1;
    else if (cell === "transit") transit += 1;
    else activities[cell] += 1;
  }
  return { activities, transit, unclaimed };
}

export function dollars(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
