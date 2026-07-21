import { eligible, type DecisionNode, type LifeStage } from "@control-ai/engine";

export interface LifestyleFocusOption {
  id: string;
  label: string;
  description: string;
  tradeoff: string;
  budgetEffect: "save" | "balanced" | "spend";
  timeEffect: "lighter" | "balanced" | "heavier";
}

export interface AnnualLifestyleFocus {
  age: number;
  title: string;
  prompt: string;
  options: readonly LifestyleFocusOption[];
}

const option = (
  id: string,
  label: string,
  description: string,
  tradeoff: string,
  budgetEffect: LifestyleFocusOption["budgetEffect"],
  timeEffect: LifestyleFocusOption["timeEffect"],
): LifestyleFocusOption => ({ id, label, description, tradeoff, budgetEffect, timeEffect });

export const ANNUAL_LIFESTYLE_FOCUSES: readonly AnnualLifestyleFocus[] = [
  { age: 18, title: "Build your first independent routine", prompt: "How much independence can you afford while you establish school, work, or service?", options: [
    option("supported-launch", "Use a supported launch", "Stay with family or use provided housing while building savings and routines.", "Less privacy, strongest financial runway.", "save", "lighter"),
    option("shared-launch", "Share the launch", "Split housing and household work with roommates or classmates.", "Moderate cost with coordination and social tradeoffs.", "balanced", "balanced"),
    option("independent-launch", "Live independently", "Pay more for privacy, control, and full responsibility.", "Maximum autonomy, thinner monthly margin.", "spend", "heavier"),
  ]},
  { age: 19, title: "Set your weekly rhythm", prompt: "What gets protected when school, work, sleep, and relationships compete?", options: [
    option("academic-push", "Prioritize school", "Reserve the largest blocks for class, study, and office hours.", "Faster academic progress with less income and social time.", "spend", "heavier"),
    option("work-school-balance", "Balance work and school", "Use steady part-time work to control borrowing without crowding out study.", "More structure and less flexibility.", "balanced", "balanced"),
    option("wellbeing-base", "Protect wellbeing", "Anchor sleep, exercise, and connection before adding optional commitments.", "Slower financial or academic pace, stronger sustainability.", "balanced", "lighter"),
  ]},
  { age: 20, title: "Choose how to fund the year", prompt: "Will time, borrowing, or lifestyle cuts carry the cost of your current path?", options: [
    option("more-work", "Work more hours", "Increase earned income and reduce reliance on debt.", "Higher cash flow, less study and recovery time.", "save", "heavier"),
    option("leaner-life", "Lower living costs", "Use roommates, meal planning, and low-cost transport to reduce the monthly burn.", "More planning and shared-space compromises.", "save", "balanced"),
    option("borrow-for-focus", "Borrow for focus", "Preserve time for training or school and accept higher future payments.", "More focus now, more financial pressure later.", "spend", "lighter"),
  ]},
  { age: 21, title: "Redesign housing and transportation", prompt: "Where should you live when rent, commute time, social support, and access pull differently?", options: [
    option("close-and-small", "Live close and small", "Pay for proximity and reclaim commute time in a smaller space.", "Higher rent per room, lower transit burden.", "spend", "lighter"),
    option("far-and-affordable", "Live farther out", "Choose lower rent and accept a longer, less flexible commute.", "Lower housing cost, higher time and transport cost.", "save", "heavier"),
    option("shared-and-central", "Share a central home", "Split a well-located place with roommates.", "Good access and cost, lower privacy.", "balanced", "balanced"),
  ]},
  { age: 22, title: "Make the school-to-work transition", prompt: "What matters most in your first full-time move: pay, learning, or place?", options: [
    option("best-learning", "Choose the learning role", "Favor mentorship, skill range, and a credible growth path.", "Possibly lower starting pay, better option value.", "balanced", "heavier"),
    option("best-pay", "Choose the higher pay", "Use compensation to stabilize cash flow and attack debt.", "Stronger finances, possibly less fit or flexibility.", "save", "heavier"),
    option("best-place", "Choose the right place", "Optimize for community, location, and everyday quality of life.", "Better life fit, potentially narrower job market.", "spend", "lighter"),
  ]},
  { age: 23, title: "Build a financial safety floor", prompt: "How will you divide limited cash among debt, emergencies, and retirement?", options: [
    option("emergency-first", "Build emergency cash", "Create a buffer before taking more investment risk.", "More resilience, slower debt or investment progress.", "save", "balanced"),
    option("debt-first", "Attack expensive debt", "Direct extra cash to the highest interest balance.", "Guaranteed interest savings, smaller cash cushion.", "save", "balanced"),
    option("match-and-balance", "Capture the match", "Contribute enough for employer matching while splitting the remainder.", "Balanced progress with fewer dramatic wins.", "balanced", "balanced"),
  ]},
  { age: 24, title: "Choose your career pace", prompt: "Do you push for growth, broaden your skills, or stabilize your life outside work?", options: [
    option("promotion-push", "Push for promotion", "Take visible projects, feedback, and stretch responsibilities.", "Higher upside with more work intensity.", "save", "heavier"),
    option("skill-portfolio", "Build portable skills", "Invest time in credentials, projects, and a stronger network.", "Up-front time or cost for broader options.", "spend", "heavier"),
    option("stability-season", "Choose stability", "Protect predictable hours and deepen life outside work.", "Slower advancement, more recoverable time.", "balanced", "lighter"),
  ]},
  { age: 25, title: "Review the quarter-life plan", prompt: "Which part of your current path deserves a deliberate reset?", options: [
    option("money-reset", "Reset the money system", "Automate bills, saving, debt payments, and guilt-free spending.", "Requires short-term discipline, reduces ongoing friction.", "save", "balanced"),
    option("career-reset", "Reset the career path", "Test a role, industry, or training change before commitments deepen.", "Uncertainty now for better long-term fit.", "balanced", "heavier"),
    option("life-reset", "Reset the weekly life", "Change routines, boundaries, friendships, or home base.", "Less optimization, stronger day-to-day alignment.", "spend", "lighter"),
  ]},
  { age: 26, title: "Decide whether to relocate", prompt: "Would a move improve income, costs, commute, belonging, or future opportunity?", options: [
    option("stay-and-root", "Stay and build roots", "Deepen local relationships, reputation, and routines.", "Low transition cost, fewer new-market opportunities.", "save", "lighter"),
    option("move-for-opportunity", "Move for opportunity", "Relocate for career growth or a stronger labor market.", "Higher disruption and moving cost, larger upside.", "spend", "heavier"),
    option("move-for-life", "Move for quality of life", "Choose affordability, community, climate, or family access.", "Lifestyle gain may require career compromise.", "balanced", "balanced"),
  ]},
  { age: 27, title: "Coordinate money with a partner or household", prompt: "How much should be shared, separate, or planned together?", options: [
    option("mostly-separate", "Keep finances mostly separate", "Share agreed bills while preserving individual accounts and autonomy.", "Clear independence, more coordination overhead.", "balanced", "balanced"),
    option("hybrid-household", "Use a hybrid system", "Fund joint goals and expenses while retaining personal spending accounts.", "More setup, good balance of clarity and autonomy.", "save", "balanced"),
    option("fully-combined", "Combine the household", "Pool income, expenses, saving, and goals into one plan.", "Maximum visibility, requires strong shared habits.", "save", "heavier"),
  ]},
  { age: 28, title: "Test homeownership readiness", prompt: "Is buying a home compatible with your cash, location plans, and maintenance capacity?", options: [
    option("rent-flexibly", "Keep renting", "Preserve mobility and transfer repair risk to a landlord.", "Less control and equity, greater flexibility.", "balanced", "lighter"),
    option("save-to-buy", "Build the buying fund", "Delay purchase while strengthening cash, credit, and price range.", "Slower move, safer eventual purchase.", "save", "balanced"),
    option("buy-smaller", "Buy within a buffer", "Choose a modest home while protecting emergency reserves.", "More responsibility and transaction cost.", "spend", "heavier"),
  ]},
  { age: 29, title: "Plan for care and family commitments", prompt: "How will children, parents, pets, or chosen family fit into time and money?", options: [
    option("prepare-for-care", "Prepare for care", "Build schedule, housing, insurance, and cash buffers before needs expand.", "Costs more now, lowers future disruption.", "spend", "heavier"),
    option("shared-care-network", "Build a care network", "Coordinate family, friends, and paid support instead of carrying everything alone.", "Requires communication and reciprocal commitments.", "balanced", "balanced"),
    option("defer-care-change", "Defer a major change", "Keep flexibility while clarifying whether and when care responsibilities fit.", "More runway, decisions remain unresolved.", "save", "lighter"),
  ]},
  { age: 30, title: "Protect health and insurability", prompt: "Which preventive systems reduce the chance that health derails the plan?", options: [
    option("preventive-baseline", "Build the preventive baseline", "Prioritize sleep, primary care, dental care, movement, and nutrition.", "Steady time and cost, broad long-term benefit.", "balanced", "balanced"),
    option("coverage-review", "Strengthen coverage", "Review health, disability, life, and liability protection.", "Higher premiums, smaller catastrophic risk.", "spend", "lighter"),
    option("performance-season", "Train for performance", "Invest in a more ambitious fitness or health goal.", "Higher time demand, meaningful wellbeing upside.", "spend", "heavier"),
  ]},
  { age: 31, title: "Choose advancement or flexibility", prompt: "What should the next role optimize: authority, expertise, or control of your time?", options: [
    option("leadership-track", "Take the leadership track", "Manage people, budgets, and outcomes for higher advancement potential.", "More responsibility and less protected time.", "save", "heavier"),
    option("expert-track", "Deepen expertise", "Become harder to replace through specialized skill and judgment.", "Focused learning load, strong portability.", "balanced", "heavier"),
    option("flexibility-track", "Optimize flexibility", "Choose remote, reduced, contract, or predictable work.", "Potential pay tradeoff, more life control.", "spend", "lighter"),
  ]},
  { age: 32, title: "Invest in the next capability", prompt: "Which learning investment has enough payoff to deserve your money and evenings?", options: [
    option("credential", "Earn a credential", "Choose a recognized certificate, license, or degree with a clear use case.", "Direct cost and study time, legible signal.", "spend", "heavier"),
    option("portfolio", "Build proof of work", "Create projects, clients, or public work that demonstrates ability.", "Less formal structure, flexible cost.", "balanced", "heavier"),
    option("network", "Build opportunity relationships", "Invest in mentors, peers, professional communities, and reciprocity.", "Harder to measure, broad access benefits.", "balanced", "balanced"),
  ]},
  { age: 33, title: "Renovate the life infrastructure", prompt: "Which recurring friction at home or work is worth fixing now?", options: [
    option("home-systems", "Improve home systems", "Use organization, maintenance, or a targeted renovation to recover time.", "Up-front cost for lower daily friction.", "spend", "lighter"),
    option("work-systems", "Improve work systems", "Delegate, automate, document, and set clearer boundaries.", "Setup effort for sustained capacity.", "balanced", "balanced"),
    option("simplify", "Remove commitments", "Sell, cancel, decline, or consolidate obligations that no longer earn their place.", "May close options, restores money and attention.", "save", "lighter"),
  ]},
  { age: 34, title: "Balance care, career, and recovery", prompt: "When several people need you, what remains protected?", options: [
    option("career-protected", "Protect career momentum", "Purchase or coordinate more support so work commitments remain stable.", "Higher support cost, protects income and trajectory.", "spend", "heavier"),
    option("care-protected", "Make room for care", "Reduce work or other commitments to be more available.", "Lower income or advancement, more presence.", "spend", "heavier"),
    option("recovery-protected", "Protect recovery", "Set minimum sleep, health, and respite requirements before allocating the rest.", "Some goals slow, burnout risk falls.", "balanced", "lighter"),
  ]},
  { age: 35, title: "Set the next savings intensity", prompt: "How aggressively should today fund future freedom?", options: [
    option("accelerate", "Accelerate saving", "Raise retirement and taxable saving while earnings are strong.", "Less lifestyle spending, earlier flexibility.", "save", "balanced"),
    option("balanced-present", "Balance now and later", "Fund future goals while preserving travel, hobbies, and family experiences.", "Moderate progress with fewer regrets.", "balanced", "balanced"),
    option("invest-in-capacity", "Invest in earning capacity", "Spend on education, tools, health, or support that may expand future income.", "Lower saving now, uncertain upside.", "spend", "heavier"),
  ]},
  { age: 36, title: "Design a sustainable work arrangement", prompt: "Which work structure can support the next five years of life?", options: [
    option("traditional-growth", "Stay on the growth track", "Keep full-time intensity and pursue compensation and responsibility.", "Strong earnings, less scheduling control.", "save", "heavier"),
    option("flex-work", "Negotiate flexibility", "Trade some visibility or pay for remote work, compressed weeks, or predictable hours.", "More control, possible career tradeoff.", "balanced", "lighter"),
    option("independent-work", "Test independent work", "Build consulting, contracting, or a small venture with controlled exposure.", "Income variability and admin load, more autonomy.", "spend", "heavier"),
  ]},
  { age: 37, title: "Strengthen the support network", prompt: "Who can you rely on—and who relies on you—when plans go sideways?", options: [
    option("local-community", "Invest locally", "Create regular ties through neighbors, groups, volunteering, or faith communities.", "Time commitment, strong practical belonging.", "balanced", "heavier"),
    option("friendship-depth", "Deepen key friendships", "Protect recurring time and honest contact with a smaller circle.", "Less breadth, stronger emotional support.", "balanced", "balanced"),
    option("family-connection", "Rebuild family connection", "Create healthier, more intentional patterns with relatives or chosen family.", "May require travel, boundaries, and repair work.", "spend", "heavier"),
  ]},
  { age: 38, title: "Update the health routine", prompt: "What routine will still work under a busy or stressful month?", options: [
    option("minimum-routine", "Set a minimum routine", "Create small non-negotiable sleep, food, movement, and care habits.", "Modest gains, high resilience.", "save", "lighter"),
    option("structured-program", "Follow a structured program", "Use classes, coaching, therapy, or training for accountability.", "Higher cost and calendar load.", "spend", "heavier"),
    option("environment-first", "Change the environment", "Make healthy choices easier through location, equipment, meal systems, and boundaries.", "Setup cost, lower ongoing willpower.", "spend", "balanced"),
  ]},
  { age: 39, title: "Create room for a meaningful experiment", prompt: "Which idea deserves a bounded test before midlife obligations deepen?", options: [
    option("sabbatical-test", "Plan a sabbatical", "Build cash and coverage for a defined period away from normal work.", "Large savings need, high renewal potential.", "spend", "lighter"),
    option("venture-test", "Test a venture", "Run a low-risk side project with a deadline and loss limit.", "More weekly work, useful evidence and upside.", "spend", "heavier"),
    option("creative-test", "Protect a creative practice", "Give a craft, cause, or long-delayed project recurring calendar space.", "Fewer optimized hours, stronger meaning.", "balanced", "balanced"),
  ]},
  { age: 40, title: "Choose the next-decade direction", prompt: "What should the next decade contain more of—and what should it stop demanding?", options: [
    option("deepen", "Deepen the current path", "Use accumulated skill, relationships, and assets to compound what already works.", "Lower disruption, risk of unexamined momentum.", "save", "balanced"),
    option("redesign", "Redesign the path", "Make a deliberate career, location, household, or lifestyle change.", "Transition cost and uncertainty, renewed alignment.", "spend", "heavier"),
    option("create-margin", "Create more margin", "Reduce fixed costs and obligations to recover time and resilience.", "Slower status growth, more freedom.", "save", "lighter"),
  ]},
] as const;

const DEFAULT_FOCUS: AnnualLifestyleFocus = {
  age: 41,
  title: "Run an annual life-design review",
  prompt: "What should this year optimize across money, time, health, work, and relationships?",
  options: [
    option("stability", "Strengthen stability", "Reduce risk, reinforce routines, and maintain dependable progress.", "Fewer dramatic changes, stronger resilience.", "save", "lighter"),
    option("growth", "Choose focused growth", "Concentrate extra time and money on one high-value goal.", "Faster progress with less slack elsewhere.", "balanced", "heavier"),
    option("renewal", "Make room for renewal", "Rebalance commitments around energy, health, and meaning.", "Some goals slow while sustainability improves.", "spend", "lighter"),
  ],
};

export function lifestyleFocusForAge(age: number): AnnualLifestyleFocus {
  return ANNUAL_LIFESTYLE_FOCUSES.find((focus) => focus.age === age) ?? { ...DEFAULT_FOCUS, age };
}

export function createLifestyleDecision(age: number, stage: LifeStage): DecisionNode {
  const focus = lifestyleFocusForAge(age);
  return {
    id: `lifestyle-year-${age}`,
    category: "lifestyle",
    trigger: "milestone",
    title: focus.title,
    prompt: `${focus.prompt} Current path: ${String(stage).replaceAll("-", " ")}.`,
    importance: "minor",
    available: () => eligible(),
    branches: focus.options.map((choice) => ({
      id: choice.id,
      label: choice.label,
      description: choice.description,
      importance: "minor",
      outcome: { mergeFlags: { [`lifestyleFocusAge${age}`]: choice.id } },
    })),
  };
}

export function isLifestyleDecisionNode(nodeId: string): boolean {
  return nodeId.startsWith("lifestyle-year-");
}
