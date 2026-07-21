# Ten story paths: life-coverage critique

> Baseline note: the critique below records the gaps found in graph version `2026.2`. Graph version `2026.3` implements the first critique-driven rules slice; the original findings remain below so the reasons for each rule are reviewable.

## Implementation update — graph `2026.3`

This is now more than a navigation/test critique. The following decisions are part of the engine graph, carry structured editor metadata and tradeoffs, update typed life state, and are selected as reflective sessions only after milestones and random events:

- Student funding: paid-work load, grants/aid, or a lower-cost school year.
- Military service design: portable credentials, transition networks, or an explicit reenlistment/reserve review.
- Sustainable work: career sprint, balanced week, skill building, or a recovery season.
- Household direction: connected independence, partnership, deliberate family planning, or dated flexibility.
- Business or stability: stable craft work, formalizing a business, delegation, or closing a side gig.
- Care and support: paid capacity, shared care, flexible work, or support-network investment.
- Resilience: cash buffer, health capacity, or balanced protection.
- Career recalibration: specialty, leadership, field pivot, or a sustainable role.
- Location reset: optimize the current base, move near opportunity/support, or choose a lower-cost location.
- Age-40 next chapter: health, career reinvention, people/community, or improving the current path.

Layoffs can now create an `unemployed` episode. A later milestone asks the player to choose a comparable-role search, fast re-entry, or retraining; the hold-out branch no longer collapses unemployment into an instantaneous cash charge. Pet adoption, side gigs, promotions, recruiter moves, marriage, children, housing, education, work, and military choices now also leave durable typed/flag state rather than disappearing from the high-level history.

The replay foundation was implemented at the same time because these decisions depend on it: versioned `LifeProfileState`, explicit complete/defer/repeatable/permanent-decline policies, and a validated `AnnualLifePlan` payload that is persisted with custom inputs and rebuilt by the engine on restore.

The regenerated ten-story artifact now contains 179 decisions and 66 quiet years, versus 103 decisions and 142 quiet years in the baseline. It covers `health` and `community` as engine categories, and every story records 7–8 critique-driven reflection decisions. The nursing/public-health fixture no longer contradicts its “continues renting” premise by buying a home.

Still open: full education progress/licensing and debt, multi-person household episodes and separation, regional markets, chronic health/disability, variable compensation, business balance sheets, and richer domain-specific editors. The per-story sections below remain the source backlog for those later slices.

## Executive assessment

The ten-path artifact is a useful **navigation smoke test**, but it is not yet evidence that the product models ten convincing lives. It proves that configured node/branch IDs remain reachable under a deliberately generous financial gate. It does not prove that the resulting financial state is viable, that choices produce coherent long-term consequences, or that the histories contain the major non-financial dimensions of a person's life.

The clearest coverage signal is silence:

- The artifact contains 103 decisions and 142 quiet years across 230 person-years (ages 18–40 for ten people), so **61.7% of modeled person-years have no engine decision**.
- Ages 36–40 are quiet for all ten stories. Ages 31–35 are quiet for eight of ten stories in every year. Thus 90 of the 100 person-years from 31–40 are quiet.
- All ten people finish in the single coarse stage `working`. Of 103 decisions, 69 are `working -> working`; the stage model cannot express most changes that distinguish one adult life from another.
- Decision categories are concentrated in education (26), career (24), family (17), lifestyle (17), and housing (12), with only three financial decisions and four military decisions. There are no first-class health, relationships/community, caregiving, place/mobility, time, identity/meaning, legal, or civic categories.
- Car, home, marriage, and first-child nodes account for 32 decisions (10 cars, eight homes, seven marriages, seven children). This makes one asset-and-nuclear-family sequence disproportionately define “adult life.”

The web-only annual lifestyle experience is a promising response to the quiet-year problem. It supplies an age-specific focus for every age 18–40 and its editor captures living situation, location pattern, transit, groceries, and weekly work/study/sleep/friends/fitness time. However, this is currently an application-layer fallback rather than a rules-engine capability. The catalog's generated node only writes an age-specific string flag; the richer editor dynamically adds a living-cost effect and loosely typed flags. These plans therefore are not part of `lifeGraph2026`, are absent from this artifact, lack shared engine schema and validation, and cannot yet drive consistent future eligibility or consequences.

## What this audit does and does not establish

The JSON methodology correctly narrows the claim:

- Scope: `LifeContext` navigation, availability gates, and branch outcomes through ages 18–40.
- Financial effects are not applied.
- A fixed high-liquidity summary is attached every year.
- Selected random nodes are injected deterministically at named ages; their actual probability behavior is not tested here.

That boundary should stay explicit. In particular:

1. All ten paths buying cars and eight buying homes is partly a fixture artifact. The fixed `$120k` liquid / `$80k` cash / eight-month emergency-fund assumption makes purchase gates reachable regardless of prior tuition, travel, unemployment, wedding, childcare, or moving choices.
2. Effects-only outcomes do not appear in `finalState.flags`. Pet adoption, side-gig income, pay changes, recurring expenses, debt, assets, and cash shocks may be in an event/snapshot layer, but this suite neither applies nor audits them. A final `LifeContext` is therefore not a high-level life summary.
3. A scheduled event being eligible does not prove it is naturally selected at the right frequency, ordered correctly against other simultaneous events, or financially survivable.

This is not a defect in a focused navigation test. It is a reason to add complementary tests rather than expand this suite's claims.

## Coverage-layer inventory

| Life dimension | Engine graph today | Web annual fallback | Remaining gap |
| --- | --- | --- | --- |
| Education | College major, one early major switch, graduation, part-time graduate school | Ages 18–22 discuss routine, funding, housing, and school-to-work priorities | No institution/program structure, credits/performance, aid/debt, internships, dropout/stop-out, transfer, licensing, academic health, or study-plan consequences |
| Work | Entry track, certification, promotion, recruiter, layoff, trade license, one business route | Career pace, learning, advancement, flexibility, independent-work prompts | No typed occupation/employer/status/hours/benefits/tenure/satisfaction; no unemployment interval, job search, workplace conditions, caregiving leave, burnout, or portable-skill graph |
| Household and relationships | Boolean `married`, optional spouse income, boolean `hasChild` | Household money and support-network prompts | No relationship history, cohabitation, separation/divorce, shared decision-making, friendship state, multiple dependents, chosen family, or care network |
| Place and housing | Boolean homeowner, fixed home prices, generic `living` expense | Five living arrangements, five location patterns, transit choices, move cost | No shared typed place/household schema, region-specific markets, lease/roommate events, housing quality/security/accessibility, or downstream commute/opportunity effects |
| Time | None | 168-hour work/study/sleep/friends/fitness/transit editor | No engine constraints, fatigue/productivity effects, schedule conflicts, caregiving/housework, or longitudinal history |
| Health and wellbeing | Random medical cash bill, generic lifestyle prompts | Preventive health, recovery, fitness options | Health is only a cost shock in the engine; no physical/mental health state, disability, access, insurance, chronic conditions, substance use, reproductive health, or work capacity |
| Money and risk | Derived summary, event effects, generic budget profiles | Grocery/living-cost editor and margin preview | No realistic effects in this audit; no credit, education debt, benefits, insurance coverage, taxes by household/place, financial dependents, or goal-specific accounts in `LifeContext` |
| Meaning and community | None | Friendship, community, creative practice, renewal, next-decade prompts | No durable goals/values/belonging state and no consequences that change later options |

### Important distinction: partly addressed versus absent

Partly addressed in the web layer: quiet-year prompts; living arrangement; generic location cost; transit time/cost; grocery amount; a weekly time budget; health, support-network, career-flexibility, and meaning-oriented prompts. These should be promoted into shared engine contracts rather than duplicated as UI-authored flags.

Absent or effectively absent everywhere inspected: relationship transitions beyond marriage; divorce/separation; non-marital households; multiple children and other dependents; elder care; actual health/disability state; academic performance and completion risk; unemployment duration and job search; workplace quality; geographic identity and migration constraints; discrimination/access needs; insurance coverage; legal/civic events; a structured personal-goals model; and longitudinal measures of satisfaction, stress, social support, or meaning.

## Per-story critique

### 1. `college-cs-grad-family`

**Recorded arc.** College and computer science at 18, a data-science switch at 20, graduation/car at 23, part-time master's at 24–26, trip at 25, marriage at 27, child at 29, home at 30, and a medical bill at 33. Thirteen years are quiet, including every year from 34–40.

**What is missing from this person's life.** The story does not say how school was funded, how the student performed, whether they interned, what the extra major-switch year did to debt or wellbeing, or how part-time graduate school coexisted with a new career. The transition from “degree” to a generic career has no first job, employer, job quality, hours, mentorship, or location. Marriage is reduced to adding income, parenthood to one childcare expense, and health to an $8,000 bill. There is no partner career trajectory, division of care, parental leave, childcare decision, social support, mental/physical recovery, relationship change, second-child/childfree decision, or life priorities after the early thirties.

**Needed rules.** Student progress and funding state; internship/job-search transitions; a time-capacity interaction between work and graduate school; typed household roles and care labor; parental leave/childcare choices; health impact and coverage; and recurring age-30s career/family/wellbeing reviews.

### 2. `college-nursing-to-public-health`

**Recorded arc.** Nursing at 18, public-health switch at 20, graduation at 23, car at 24, retirement boost at 25, pet at 27, recruiter at 30, and home at 32. Fifteen years are quiet. The stated premise says the person “rents,” but the decisions and final `homeowner: true` say they buy a home at 32.

**What is missing from this person's life.** The premise/artifact contradiction should fail validation, not survive as prose. Neither nursing nor public health includes prerequisites, clinical placements, licensure, specialization, job setting, shift work, public-service motivation, or the reason and consequences of switching. Pet adoption is recorded in history but leaves no navigation flag because its result is effect-only. “Remains independent” and “does not marry” are inferred from an omitted choice; at 40, `marriage` is still available. The model has not captured a deliberate relationship/household choice, friendships, community, caregiving, health, or why homeownership fits this supposedly mobile/independent life.

**Needed rules.** Premise/state invariant tests; profession-specific credential transitions; explicit “not a current goal” decisions with review dates rather than permanent or silent omission; pet/dependent state shared across context and snapshots; and independent/cohousing/partnered household forms that are not synonyms for married/unmarried.

### 3. `direct-work-retail-family`

**Recorded arc.** Retail work at 18, certification and rent hike at 20, car at 21, supervisor at 22, layoff at 24, single-income marriage at 26, home at 28, child at 29, and home repair at 34. Fourteen years are quiet.

**What is missing from this person's life.** The layoff is an instantaneous 15% pay scaling rather than a period of unemployment, search, retraining, lost benefits, stress, or changed housing/child plans. “Single-income family” represents the spouse only as absent income; unpaid care, the partner's preferences, later return to work, benefits, and household bargaining do not exist. Retail work has no schedule volatility, benefits, customer-facing strain, job security, or route out of management. There is no childcare arrangement, parental leave, food/time pressure, social network, family health, or recovery from the home repair.

**Needed rules.** Employment-status intervals and job-search decisions; variable schedules/benefits; a household-member model with paid and unpaid work; partner re-entry and caregiving choices; childcare modes and availability; and coupled shocks that can delay housing or career plans.

### 4. `direct-work-tech-mobile`

**Recorded arc.** Web development at 18, certification at 20, new car at 21, promotion at 22, side gig at 23, recruiter at 25, trip at 28, and layoff/hold-out at 35. Fifteen years are quiet, and all years 36–40 are silent.

**What is missing from this person's life.** The premise promises career mobility and multiple income streams, but `finalState.flags` records neither the side gig nor job changes because those are effects-only and not applied by this audit. “Mobile” has no actual location history, remote-work arrangement, commute, moving event, or community tradeoff. Main job, certification, side gig, and promotion have no combined time load, burnout risk, intellectual growth, job satisfaction, or business maturity. Remaining unmarried and not owning a home are again omissions, not values-based choices. The age-35 layoff “hold out” spends cash but models no duration, insurance, identity, mental health, or outcome uncertainty.

**Needed rules.** Typed multi-job/workload state; location and remote-work transitions; side-gig growth/closure/incorporation decisions; work intensity and burnout; unemployment duration and search strategy; and explicit flexible-housing/relationship goals.

### 5. `electrician-business-owner`

**Recorded arc.** Electrician apprenticeship at 18, car at 20, journeyman ticket at 21, side gig at 23, shop at 25, marriage at 26, home at 27, child at 28, and home repair at 32. Fourteen years are quiet.

**What is missing from this person's life.** “Business owner” is implemented as a better `job` income configuration. It has no business entity, clients, revenue volatility, equipment/vehicle financing, insurance, employees, taxes, safety compliance, working capital, failure/exit path, or effect on household time and risk. The side gig is not represented in final context. Trade work has no injury, physical wear, continuing education, union status, geographic licensing, or mentorship. Family choices do not interact with the startup's workload, benefits, parental leave, or home risk.

**Needed rules.** A small-business state machine; variable income and liquidity; occupational health/safety; licensing renewal and geographic portability; employee/delegation decisions; and household risk/time negotiation during entrepreneurship.

### 6. `hvac-journeyman-stable`

**Recorded arc.** HVAC apprenticeship at 18, ticket at 21, cash car at 22, retirement boost at 24, rent hike at 25, single-income marriage at 29, child at 31, and medical bill at 34. Fifteen years are quiet. At 40, both `first-home` and `master-license` remain available.

**What is missing from this person's life.** “Chooses stability” is not a recorded choice: it is inferred because the test never schedules the available master-license branch. Likewise, continued renting is not a durable decision. There is no explanation of what stability means—predictable hours, union benefits, location, health, family time, satisfaction, or risk tolerance. Physical trade demands and the medical event have no impact on work capacity. The one-income household again has no partner or care-work state.

**Needed rules.** Explicit stay/decline choices with a reconsideration horizon; preference/goals state; work-quality and physical-capacity measures; renting as a positive housing plan rather than non-purchase; and household care/work allocation.

### 7. `army-gi-bill-nurse`

**Recorded arc.** Army at 18, pet at 20, separation/GI Bill/nursing at 22, trip at 25, graduation at 26, car at 27, marriage at 28, child at 30, home at 31, and medical bill at 35. Thirteen years are quiet, including two of four active-service years.

**What is missing from this person's life.** Military service is a branch label, salary, low living cost, and four-year timer. There is no specialty, duty location, deployment, rank, housing mode, relocation, family separation, service injury/disability, mental health, discharge type, re-enlistment, reserve component, or transition assistance. Pet adoption during active service ignores deployment and military-housing constraints. The GI Bill is a flat tuition discount rather than eligibility months, housing allowance, program approval, or benefit tradeoffs. Nursing still lacks clinical/licensing and shift-work decisions. The later household path repeats the same marriage-child-home defaults.

**Needed rules.** Service episode state and military-specific events; relocation/deployment constraints; health/disability and veteran-benefit state; re-enlist/reserve paths; GI Bill benefit accounting; professional licensure; and family/time decisions compatible with shift work.

### 8. `air-force-civilian-family`

**Recorded arc.** Air Force at 18, civilian work at 22, new car at 23, retirement boost at 24, promotion at 25, marriage at 26, home at 28, child at 29, and layoff at 33. Fourteen years are quiet; ages 34–40 contain no decisions.

**What is missing from this person's life.** Three of the four service years are narratively empty, and the service specialty has no relationship to the generic civilian role. There is no credential transfer, relocation, transition difficulty, benefits, disability, community, or military-family impact. The civilian promotion and later layoff affect pay but not duties, skills, tenure, unemployment, healthcare, family plans, or wellbeing. Having no available opportunities at 40 looks like graph exhaustion, not a complete life.

**Needed rules.** Military-to-civilian skill mapping; veteran benefits and health; geographic relocation; job-quality/identity transitions; layoff sequences; and annual goals across family, community, health, and meaning after the asset milestones resolve.

### 9. `gap-year-business-degree`

**Recorded arc.** Gap year at 18, college/business and a $12,000 trip at 19, graduation at 23, car and part-time graduate school at 24, master's at 26, marriage at 27, home at 29, and child at 30. Fifteen years are quiet.

**What is missing from this person's life.** The gap year is only a stage timer plus a travel expense. There is no work, volunteering, caregiving, visa/safety, learning, location, social connection, funding, or decision evidence that changes the subsequent path. College then has no decisions for ages 20–22. Business education and graduate school confer generic salary changes without specialization, experience, network, debt, or career fit. The later story follows the same marriage-home-child sequence and becomes silent after 30.

**Needed rules.** Structured gap-year plans and outcomes; learning/work/volunteer episodes; school funding and performance; internships and specialization; career selection after business school; and age-30s household/career/health reviews.

### 10. `gap-year-sales-independent`

**Recorded arc.** Gap year at 18, sales at 19, car at 20, certification at 21, side gig at 22, promotion at 23, recruiter at 24, pet at 26, and home at 30. Fourteen years are quiet, including every year 31–40.

**What is missing from this person's life.** “Independent” and unmarried are inferred from absent marriage choices, not modeled preferences. Sales is treated as fixed salary despite commission volatility, targets, travel, burnout, employer changes, and recession sensitivity. The side gig and adopted pet do not survive into the final navigation state. Buying a home has no household composition, place, commute, maintenance capacity, or effect on career mobility. There is no friendship/community, health, care responsibility, later career reinvention, or explicit life direction through the thirties.

**Needed rules.** Variable compensation and performance; active independent/partnered/cohousing household decisions; durable pet/dependent state; side-business evolution; place/commute constraints; and recurring career, support-network, health, and meaning decisions.

## Cross-story rules and schema gaps

### 1. `LifeContext.flags` is memory, not a life model

The open `Record<string, JsonValue>` makes prototyping easy but produces scattered booleans and magic keys: `married`, `hasChild`, `homeowner`, `hasCar`, `major`, and dynamically generated lifestyle flags. It cannot validate contradictions, intersections, histories, or lifecycle transitions. Add versioned typed substate while retaining an extension bag only for experiments:

- `education`: programs, institution/type, credits/progress, performance, funding/aid/debt, credentials, licensing.
- `work`: employment episodes, occupation, employer/type, status, hours, schedule, benefits, tenure, pay structure, flexibility, satisfaction, skills.
- `household`: people, relationship type/status, living arrangement, income/care contribution, dependents and care responsibilities.
- `placeHousing`: region, cost index, housing tenure/type/quality, lease/mortgage, move history, commute/accessibility.
- `time`: weekly allocation, fixed commitments, capacity, overload, schedule history.
- `wellbeing`: physical and mental health, disability/access needs, stress/burnout, social support, coverage and care access.
- `goals`: ranked priorities, target horizon, preference strength, deliberate deferrals, next review month.

Use entity IDs and effective-month intervals rather than single booleans so changes such as divorce, job loss, moving, returning to school, selling a car/home, or a child aging are representable.

### 2. “Not now” currently behaves like “never”

`resolveBranch` marks a node resolved unless a branch explicitly reopens it. Generic decline branches for marriage (“Not yet”), first child (“Not now”), first home (“Keep renting”), promotion, certification, graduate school, and other opportunities generally do not reopen. The label promises reconsideration while the transition permanently suppresses the node. This is a sequencing defect.

Add resolution policies such as `complete`, `deferUntilMonth`, `cooldownMonths`, `repeatable`, and `declinePermanently`. A deliberate “I do not want children/homeownership/marriage” should be persistable, but distinct from “not this year.” Tests should verify the copy and re-offer policy agree.

### 3. The graph cannot model episodes or consequences over time

Layoff, education, military service, caregiving, illness, relocation, and business ownership are processes, not instantaneous flags/pay mutations. Introduce episode state with start/end months and transition nodes. Later availability should depend on episode outcomes, accumulated time, and capacity—not only age, coarse stage, and boolean flags.

### 4. Lifestyle planning is authored in the UI

`ANNUAL_LIFESTYLE_FOCUSES` covers all requested ages and the editor meaningfully previews budget and time. But the plan options, default values, mutations, and flag keys are application code. This creates three risks:

- Engine replays and non-web clients do not share the same decisions.
- UI-created branch IDs such as `*-custom-plan` are not catalog branches recoverable through `findBranch`.
- A generic `setLivingCost` collapses housing, utilities, transport, and groceries into one expense, while the time plan has no engine effect or validation.

Move lifestyle plan schemas, validation, effect construction, and age/stage applicability into the engine. Let the UI remain the editor/visualization surface.

### 5. Trigger arbitration is underspecified

The selectors prioritize graph order and importance, while random rolls and the web fallback are orchestrated by callers. The model needs an explicit yearly agenda policy for simultaneous milestone, expiring opportunity, random shock, and annual review. It should define whether a shock can interrupt a plan, whether multiple decisions can occur, what can be deferred, and how a player's chosen goals influence what is surfaced. Without this, caller order becomes game logic.

### 6. Representation and assumption risks

- `first-child` requires `married` and age 28; marriage is unavailable in school/military and before 26. This excludes single parents, cohabiting parents, adoption/fostering, stepfamilies, early parents, infertility, and families formed while studying or serving.
- Household state is either dual-income marriage or “a partner at home”; it does not represent the partner as a person with agency, changing work/care, debt, health, or goals.
- Every income defaults to Texas and fixed nominal salary/cost assumptions. Place, local labor/housing markets, taxes, licensing, immigration, and relocation constraints are absent.
- Health is framed mostly as a random bill. Disability, chronic illness, mental health, access to care, and changes in capacity are missing.
- Success is implicitly credential/work/promotion/car/home/marriage/child/retirement. Renting, remaining single, childfree life, community care, creative work, lower-paid purpose-driven work, and reduced hours appear mostly as omissions or UI prose rather than first-class successful paths.
- The sample is root-balanced, not population-representative. It includes no dropout/stop-out, prolonged unemployment, divorce, disability, caregiving, housing insecurity, business failure, non-degree training outside three trades, or sustained low-liquidity path.

Treat these as product-model assumptions to make configurable and reviewable, not as more random events to sprinkle into the catalog.

## Implementation-prioritized backlog

### P0 — Make histories coherent and replayable

1. **Define typed, versioned life substate.** Start with household, work episode, education episode, place/housing, time budget, wellbeing, and goals. Provide migrations from current flags.
2. **Add explicit resolution/re-offer semantics.** Replace implicit one-time resolution for declines with complete/defer/cooldown/permanent policies.
3. **Promote annual lifestyle plans into the engine.** Store a stable plan ID plus structured budget/time/place inputs; construct effects in the engine; make every persisted branch replayable through catalog/version or an explicit custom-decision payload.
4. **Separate navigation and financial integration tests.** Keep the current fixed-finance suite, then add a suite that applies every effect to a seeded snapshot, ticks the year, recomputes finances, and verifies later gates and final assets/debts/income/expenses.
5. **Add artifact coherence validation.** Premise claims, decision history, final context, and financial snapshot should agree. The nursing/public-health “rents” versus `homeowner: true` contradiction should fail.

### P1 — Add the missing high-impact life systems

6. **Household and care graph.** Cohabitation/marriage alternatives, deliberate single/childfree choices, separation/divorce, multiple children/dependents, elder care, partner work/care transitions, childcare and parental leave.
7. **Employment episodes.** Employment status, job search, hours/schedule, benefits, variable compensation, leave, workplace quality, burnout, layoffs with duration and outcomes, reskilling and return-to-school.
8. **Place/housing/mobility.** Region and market indexes, move reasons/costs, leases/roommates, housing security/quality, commute/accessibility, remote work, buy/sell/refinance—not just renter/homeowner.
9. **Health and capacity.** Preventive care, physical/mental health, disability/access, insurance, chronic conditions, occupational injury, care availability, and effects on money/time/work.
10. **Education depth.** Aid/loans, progress/performance, transfer/stop-out, internships, credential/licensing requirements, school-work overload, and completion risk.

### P2 — Make the tree personal rather than age-scripted

11. **Goals/preferences state and review cadence.** Use player priorities to rank relevant decisions; record active deferrals and why. Age should be one signal, not the story generator.
12. **Social/community/meaning systems.** Friendship/support strength, community participation, creativity/service, belonging, and recovery. These need modest consequences and future hooks, not just flavor text.
13. **Domain-specific paths.** Business ownership, military service, shift professions, commissioned sales, caregiving, and other paths need distinct processes rather than salary presets.
14. **Configurable assumptions and representation review.** Externalize geography, prices, household norms, eligibility ages, and demographic/access assumptions. Review fixtures as a scenario matrix rather than claiming representativeness from ten stories.

## Proposed test backlog

### Navigation and sequencing

- A “Not now” branch reappears after its configured cooldown; a permanent decline does not.
- Simultaneous milestone, opportunity, random shock, and annual-review candidates follow one documented arbitration policy.
- A deferred decision retains its reasons and next-review month across serialization/replay.
- Annual lifestyle review exists for every age 18–40 when no higher-priority action occurs, and it is stage/context appropriate rather than only age-specific.
- Returning to school, losing a job, moving, separating, selling a home/car, and ending a side gig correctly reopen/block downstream nodes.

### State and replay

- Every decision record can reconstruct both `LifeContext` and the financial snapshot from versioned inputs; custom lifestyle branches do not depend on a UI closure.
- Entity histories preserve multiple jobs, moves, relationships, dependents, credentials, and health/work episodes without contradictory booleans.
- Pet, side-gig, recruiter/promotion, move, and schedule decisions are visible in the final high-level summary even when their primary mutation lives in the financial layer.
- Premise/history/final-state invariants catch “rents but homeowner,” “multiple income streams but no side income,” and “chooses stability but never records a stability choice.”

### Financial integration

- Re-run all ten stories while applying effects and recomputing gates; assert no purchase is funded by the fixture's static money summary.
- Add low-, median-, and high-liquidity variants; home/car/graduate-school availability and chosen outcomes should differ coherently.
- Assert cash, debt, recurring expenses, taxes, benefits, tuition, childcare end dates, and net worth after each major branch.
- Exercise adverse sequences such as layoff after home/child, medical event during school, business loss, and move while indebted.

### Time, health, and household constraints

- Reject or warn on weekly plans above 168 hours and on unsafe sleep; include housework and caregiving, not only work/study/friends/fitness/transit.
- Verify long work + study + side-gig schedules affect performance, stress, or availability rather than remaining descriptive.
- Test children without marriage, marriage while studying/serving, cohabitation, deliberate childfree/single paths, divorce, multiple dependents, and elder care.
- Test disability/access needs and chronic health constraints without reducing them to a one-time cash penalty.

### Coverage and fairness

- Maintain a machine-readable scenario matrix across root path, liquidity, household form, place/cost market, health/access, caregiving, employment disruption, and education completion—not only root-branch balance.
- Assert each life has meaningful opportunities in health, relationships/support, place, time, work/learning, money, and meaning over a rolling multi-year window, while allowing players to opt into a quiet/stable year.
- Test random-event seeded reproducibility, actual rate bounds, mutual exclusion/cooldowns, and dependence on relevant exposure. The current deterministic injection suite should remain separate.
- Snapshot high-level life summaries at 25, 30, 35, and 40 and review whether each can answer: where/how they live; who matters and who depends on them; what work/learning they do; health and capacity; time use; financial resilience; current goals; and recent turning points.

## Recommended next slice

The smallest implementation slice that unlocks the rest is not another set of age-specific prompts. It is a shared, replayable `AnnualLifePlan` plus typed `HouseholdState`, `PlaceState`, and `TimeBudget`, together with explicit defer/re-offer semantics. Port the existing web editor onto those contracts, add financial-effect integration for the ten stories, and generate age-25/30/35/40 high-level summaries. That would turn the existing strong UI concept into rules data that future decisions can actually read, while immediately exposing contradictions and missing consequences in these ten paths.
