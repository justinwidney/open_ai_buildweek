export type ChoiceKind = "career" | "major";

export interface DecisionChoiceDetails {
  id: string;
  kind: ChoiceKind;
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  startingSalary: number;
  cost: number;
  costLabel: string;
  timeLabel: string;
  outlook: "Steady" | "Growing" | "Fast growing" | "Competitive";
  tags: readonly string[];
  note: string;
}

type ChoiceTuple = readonly [
  id: string,
  category: string,
  difficulty: 1 | 2 | 3 | 4 | 5,
  startingSalary: number,
  cost: number,
  costLabel: string,
  timeLabel: string,
  outlook: DecisionChoiceDetails["outlook"],
  tags: readonly string[],
  note: string,
];

function fromTuples(kind: ChoiceKind, rows: readonly ChoiceTuple[]): readonly DecisionChoiceDetails[] {
  return rows.map(([id, category, difficulty, startingSalary, cost, costLabel, timeLabel, outlook, tags, note]) => ({
    id, kind, category, difficulty, startingSalary, cost, costLabel, timeLabel, outlook, tags, note,
  }));
}

const careerRows: readonly ChoiceTuple[] = [
  ["retail", "Service", 2, 31_200, 250, "Typical setup", "Days", "Steady", ["people", "flexible shifts", "management path"], "A quick start with strong practice in customer service and team leadership."],
  ["warehouse", "Operations", 3, 38_400, 350, "Typical setup", "Days", "Growing", ["active", "shift work", "logistics"], "Reliable hours and a visible path into inventory, dispatch, and supervision."],
  ["sales", "Business", 4, 36_000, 500, "Typical setup", "1–2 weeks", "Growing", ["commission", "people", "fast growth"], "Income can vary, but communication skill and results can accelerate advancement."],
  ["administrative-assistant", "Business", 2, 37_800, 600, "Skills & setup", "2–6 weeks", "Steady", ["office", "organized", "transferable"], "Build a foundation in scheduling, records, software, and team coordination."],
  ["customer-support", "Technology", 3, 36_600, 450, "Home-office setup", "1–3 weeks", "Growing", ["remote options", "problem solving", "people"], "A strong launch point into operations, account management, or product support."],
  ["bank-teller", "Finance", 2, 37_200, 300, "Typical setup", "1–3 weeks", "Steady", ["finance", "structured", "customer service"], "Learn day-to-day banking while building trust, accuracy, and sales experience."],
  ["construction-laborer", "Skilled work", 4, 42_600, 900, "Gear & safety", "1–4 weeks", "Growing", ["outdoors", "active", "crew work"], "Physical work with practical routes into equipment operation and specialized trades."],
  ["delivery-driver", "Transportation", 3, 40_200, 650, "License & gear", "1–3 weeks", "Growing", ["independent", "active", "early shifts"], "A self-directed role where route knowledge, safety, and reliability matter."],
  ["medical-assistant", "Healthcare", 4, 41_400, 3_800, "Training estimate", "6–12 months", "Fast growing", ["patients", "clinical", "certificate"], "Blend patient care and administrative skills in clinics and physician offices."],
  ["pharmacy-technician", "Healthcare", 4, 39_600, 2_400, "Training estimate", "3–9 months", "Growing", ["detail oriented", "healthcare", "certificate"], "Precision-focused work with a clear credential path and varied care settings."],
  ["it-support", "Technology", 4, 46_200, 1_200, "Training & exam", "2–6 months", "Fast growing", ["technical", "certifications", "hybrid"], "Troubleshooting experience can lead into systems, networking, or security."],
  ["junior-web-developer", "Technology", 5, 51_000, 4_500, "Portfolio training", "4–12 months", "Competitive", ["creative", "technical", "portfolio"], "A portfolio-driven route with higher upside and a steeper self-study ramp."],
  ["security-officer", "Public safety", 3, 37_800, 700, "License & uniform", "2–6 weeks", "Steady", ["shift work", "observant", "structured"], "Dependable work that rewards composure, documentation, and situational awareness."],
  ["food-service", "Hospitality", 4, 33_000, 350, "Typical setup", "Days", "Steady", ["fast paced", "teamwork", "flexible shifts"], "A rapid entry with clear steps toward lead, kitchen, and restaurant management roles."],
  ["childcare-assistant", "Care", 4, 34_200, 900, "Checks & training", "2–8 weeks", "Growing", ["children", "purpose driven", "active"], "Meaningful, high-energy work that develops patience, planning, and communication."],
  ["manufacturing", "Operations", 4, 43_200, 1_100, "Gear & training", "2–8 weeks", "Growing", ["technical", "shift work", "process"], "Build equipment and quality skills with room to advance into maintenance or supervision."],
  ["landscaping", "Skilled work", 4, 36_600, 950, "Tools & gear", "1–3 weeks", "Steady", ["outdoors", "seasonal", "ownership path"], "Hands-on outdoor work with a practical route toward crew leadership or a small business."],
  ["call-center", "Service", 3, 35_400, 400, "Home-office setup", "1–2 weeks", "Steady", ["communication", "metrics", "remote options"], "Develop concise communication and resilience in a measurable service environment."],
  ["bookkeeping", "Finance", 3, 42_000, 1_600, "Course & software", "2–6 months", "Growing", ["numbers", "office", "certificate"], "Accuracy and software fluency can grow into payroll, accounting, or independent clients."],
  ["real-estate", "Business", 4, 38_400, 2_300, "Course & license", "2–5 months", "Competitive", ["people", "commission", "license"], "Learn transactions and local markets while preparing for a licensed sales role."],
] as const;

const majorRows: readonly ChoiceTuple[] = [
  ["nursing", "Health", 5, 74_400, 68_400, "4-year tuition + books", "4 years", "Fast growing", ["clinical", "licensed", "people"], "Demanding clinical training with a direct, licensed path into patient care."],
  ["computer-science", "Technology", 5, 96_000, 77_600, "4-year tuition + books", "4 years", "Fast growing", ["coding", "math", "versatile"], "A rigorous technical foundation with many software and systems career routes."],
  ["business", "Business", 3, 66_000, 72_800, "4-year tuition + books", "4 years", "Growing", ["broad", "leadership", "networking"], "A flexible degree spanning operations, marketing, management, and entrepreneurship."],
  ["liberal-arts", "Humanities", 3, 50_400, 64_000, "4-year tuition + books", "4 years", "Competitive", ["writing", "critical thinking", "flexible"], "Broad analytical and communication skills; internships sharpen the career route."],
  ["accounting", "Business", 4, 70_800, 70_400, "4-year tuition + books", "4 years", "Growing", ["numbers", "credential path", "structured"], "A precise business degree with strong routes into audit, tax, and corporate finance."],
  ["mechanical-engineering", "Engineering", 5, 88_800, 84_800, "4-year tuition + books", "4 years", "Growing", ["math", "design", "labs"], "Intensive math and design work that opens manufacturing, energy, and product roles."],
  ["education", "Public service", 4, 54_000, 61_600, "4-year tuition + books", "4 years", "Steady", ["teaching", "licensed", "people"], "Classroom practice and certification lead to a direct, community-centered profession."],
  ["psychology", "Social science", 4, 55_200, 65_600, "4-year tuition + books", "4 years", "Growing", ["research", "people", "grad-school option"], "Study behavior and research methods; clinical routes usually require further study."],
  ["biology", "Science", 5, 61_200, 73_200, "4-year tuition + books", "4 years", "Growing", ["labs", "science", "grad-school option"], "A lab-heavy foundation for healthcare, research, environment, or further study."],
  ["communications", "Media", 3, 57_600, 64_800, "4-year tuition + books", "4 years", "Competitive", ["writing", "media", "people"], "Build clear storytelling and audience skills for media, marketing, and public relations."],
  ["criminal-justice", "Public service", 3, 58_800, 62_400, "4-year tuition + books", "4 years", "Steady", ["policy", "law", "public service"], "Explore justice systems, investigation, policy, and community safety careers."],
  ["economics", "Social science", 5, 75_600, 74_800, "4-year tuition + books", "4 years", "Growing", ["math", "analysis", "policy"], "Quantitative reasoning for finance, policy, consulting, and market analysis."],
  ["graphic-design", "Creative", 4, 56_400, 70_400, "4-year tuition + books", "4 years", "Competitive", ["portfolio", "creative", "software"], "A studio and portfolio path into brand, product, motion, and digital design."],
  ["cybersecurity", "Technology", 5, 91_200, 79_600, "4-year tuition + books", "4 years", "Fast growing", ["security", "technical", "certifications"], "Technical defense, risk, and systems work with strong certification value."],
  ["data-science", "Technology", 5, 98_400, 82_000, "4-year tuition + books", "4 years", "Fast growing", ["math", "coding", "analytics"], "A high-intensity blend of statistics, programming, and domain problem solving."],
  ["social-work", "Public service", 4, 51_600, 61_600, "4-year tuition + books", "4 years", "Growing", ["people", "community", "licensed path"], "Purpose-driven work supporting people and communities through complex situations."],
  ["public-health", "Health", 4, 63_600, 70_400, "4-year tuition + books", "4 years", "Growing", ["community", "analysis", "health"], "Work on prevention, programs, data, and policy across populations."],
  ["finance", "Business", 4, 79_200, 74_800, "4-year tuition + books", "4 years", "Growing", ["numbers", "markets", "business"], "A quantitative business path into banking, planning, investment, and corporate roles."],
  ["environmental-science", "Science", 4, 62_400, 70_400, "4-year tuition + books", "4 years", "Growing", ["fieldwork", "science", "sustainability"], "Combine science and fieldwork to address land, water, climate, and compliance challenges."],
  ["hospitality", "Hospitality", 3, 56_400, 64_000, "4-year tuition + books", "4 years", "Growing", ["people", "operations", "travel"], "A people-and-operations degree for hotels, events, tourism, and food service leadership."],
] as const;

export const CAREER_CHOICES = fromTuples("career", careerRows);
export const MAJOR_CHOICES = fromTuples("major", majorRows);

export function detailsForDecision(nodeId: string): readonly DecisionChoiceDetails[] | null {
  if (nodeId === "entry-track") return CAREER_CHOICES;
  if (nodeId === "declare-major" || nodeId === "swap-major") return MAJOR_CHOICES;
  return null;
}
