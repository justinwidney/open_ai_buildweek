import { useMemo, useState, type FormEvent } from "react";
import type { PayCadence } from "@control-ai/shared/life-sim";
import "../lab.css";
import "../decision-travel/theme.css";
import "./OnboardingLab.css";
import {
  ONBOARDING_PROFILE_STORAGE_KEY,
  type CommunityType,
  type CompensationBasis,
  type EducationLevel,
  type JourneyOnboardingProfile,
  type WorkScheduleKind,
} from "./onboarding.types";

const EDUCATION_OPTIONS: readonly { id: EducationLevel; label: string; detail: string; symbol: string }[] = [
  { id: "high-school", label: "High school", detail: "Diploma or equivalent", symbol: "A" },
  { id: "trade-certificate", label: "Trade or certificate", detail: "Apprenticeship or focused training", symbol: "T" },
  { id: "college-diploma", label: "College diploma", detail: "Two- or three-year program", symbol: "C" },
  { id: "bachelors", label: "Bachelor's degree", detail: "Undergraduate degree", symbol: "B" },
  { id: "graduate", label: "Graduate degree", detail: "Master's or professional degree", symbol: "G" },
  { id: "other", label: "Another path", detail: "Self-taught or not listed", symbol: "+" },
];

const OCCUPATIONS = [
  { id: "retail-associate", title: "Retail associate", sector: "Retail", pay: "$31k–$45k", symbol: "R" },
  { id: "office-admin", title: "Office administrator", sector: "Business", pay: "$40k–$60k", symbol: "O" },
  { id: "software-developer", title: "Software developer", sector: "Technology", pay: "$65k–$130k", symbol: "</>" },
  { id: "healthcare-aide", title: "Health care aide", sector: "Health", pay: "$39k–$58k", symbol: "+" },
  { id: "registered-nurse", title: "Registered nurse", sector: "Health", pay: "$70k–$105k", symbol: "N" },
  { id: "electrician", title: "Electrician", sector: "Trades", pay: "$58k–$100k", symbol: "E" },
  { id: "heavy-equipment", title: "Equipment operator", sector: "Industry", pay: "$55k–$95k", symbol: "H" },
  { id: "teacher", title: "Teacher", sector: "Education", pay: "$55k–$98k", symbol: "T" },
  { id: "hospitality", title: "Hospitality worker", sector: "Service", pay: "$30k–$55k", symbol: "H" },
  { id: "sales-representative", title: "Sales representative", sector: "Sales", pay: "$45k–$120k", symbol: "$" },
  { id: "student", title: "Student", sector: "Education", pay: "Varies", symbol: "S" },
  { id: "caregiver", title: "Unpaid caregiver", sector: "Home", pay: "Unpaid", symbol: "C" },
] as const;

const STEPS = [
  { number: 1, label: "Your beginnings", short: "About you" },
  { number: 2, label: "Road travelled", short: "Experience" },
  { number: 3, label: "At the trailhead", short: "Review" },
] as const;

interface DemographicDraft {
  age: string;
  countryCode: string;
  location: string;
  communityType: CommunityType;
  educationLevel: EducationLevel | "";
  fieldOfStudy: string;
}

interface WorkDraft {
  hasPriorExperience: boolean;
  occupationId: string;
  yearsExperience: string;
  compensationBasis: CompensationBasis;
  payCadence: PayCadence;
  scheduleKind: WorkScheduleKind;
  averageHoursPerWeek: string;
  grossPay: string;
  hasBonusOrCommission: boolean;
  notes: string;
}

const initialDemographics: DemographicDraft = { age: "25", countryCode: "CA", location: "", communityType: "large-city", educationLevel: "", fieldOfStudy: "" };
const initialWork: WorkDraft = { hasPriorExperience: true, occupationId: "", yearsExperience: "2", compensationBasis: "salary", payCadence: "biweekly", scheduleKind: "standard", averageHoursPerWeek: "40", grossPay: "", hasBonusOrCommission: false, notes: "" };

export interface OnboardingExperienceProps {
  onComplete?: (profile: JourneyOnboardingProfile) => void;
  showLabBack?: boolean;
}

function numeric(value: string) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function OnboardingExperience({ onComplete, showLabBack = true }: OnboardingExperienceProps) {
  const [step, setStep] = useState(1);
  const [demographics, setDemographics] = useState(initialDemographics);
  const [work, setWork] = useState(initialWork);
  const [jobSearch, setJobSearch] = useState("");
  const [error, setError] = useState("");
  const [completedProfile, setCompletedProfile] = useState<JourneyOnboardingProfile | null>(null);

  const selectedOccupation = OCCUPATIONS.find(({ id }) => id === work.occupationId) ?? null;
  const visibleOccupations = useMemo(() => {
    const query = jobSearch.trim().toLocaleLowerCase();
    return query ? OCCUPATIONS.filter(({ title, sector }) => `${title} ${sector}`.toLocaleLowerCase().includes(query)) : OCCUPATIONS;
  }, [jobSearch]);

  function goToStep(next: number) {
    setError("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueFromDemographics(event: FormEvent) {
    event.preventDefault();
    const age = numeric(demographics.age);
    if (age < 16 || age > 80) return setError("Enter an age between 16 and 80.");
    if (!demographics.location.trim()) return setError("Tell us where you are beginning your journey.");
    if (!demographics.educationLevel) return setError("Choose the education path closest to yours.");
    goToStep(2);
  }

  function continueFromWork(event: FormEvent) {
    event.preventDefault();
    if (work.hasPriorExperience && !selectedOccupation) return setError("Choose the role that best matches your recent experience.");
    if (numeric(work.yearsExperience) < 0) return setError("Years of experience cannot be negative.");
    if (numeric(work.grossPay) < 0) return setError("Pay cannot be negative.");
    if (work.compensationBasis === "hourly" && (numeric(work.averageHoursPerWeek) <= 0 || numeric(work.averageHoursPerWeek) > 112)) return setError("Enter average weekly hours between 1 and 112.");
    goToStep(3);
  }

  function finishOnboarding() {
    const grossPay = numeric(work.grossPay);
    const profile: JourneyOnboardingProfile = {
      schemaVersion: 1,
      completedAt: new Date().toISOString(),
      demographics: {
        age: numeric(demographics.age),
        countryCode: demographics.countryCode,
        location: demographics.location.trim(),
        communityType: demographics.communityType,
        educationLevel: demographics.educationLevel as EducationLevel,
        fieldOfStudy: demographics.fieldOfStudy.trim() || null,
      },
      workExperience: {
        hasPriorExperience: work.hasPriorExperience,
        occupationId: work.hasPriorExperience ? selectedOccupation?.id ?? null : null,
        occupationTitle: work.hasPriorExperience ? selectedOccupation?.title ?? null : null,
        yearsExperience: work.hasPriorExperience ? numeric(work.yearsExperience) : 0,
        compensationBasis: work.hasPriorExperience ? work.compensationBasis : null,
        payCadence: work.hasPriorExperience ? work.payCadence : null,
        scheduleKind: work.hasPriorExperience ? work.scheduleKind : null,
        averageHoursPerWeek: work.hasPriorExperience && work.compensationBasis === "hourly" ? numeric(work.averageHoursPerWeek) : null,
        grossHourlyRateCents: work.hasPriorExperience && work.compensationBasis === "hourly" && grossPay > 0 ? Math.round(grossPay * 100) : null,
        grossPayPerPeriodCents: work.hasPriorExperience && work.compensationBasis !== "hourly" && grossPay > 0 ? Math.round(grossPay * 100) : null,
        hasBonusOrCommission: work.hasPriorExperience && work.hasBonusOrCommission,
        notes: work.notes.trim() || null,
      },
    };
    sessionStorage.setItem(ONBOARDING_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    setCompletedProfile(profile);
    onComplete?.(profile);
  }

  const activeStep = STEPS[step - 1] ?? STEPS[0];
  return (
    <main className="onboarding-shell">
      {showLabBack && <a className="onboarding-back" href="/labs/">← Labs</a>}
      <div className="onboarding-sky" aria-hidden="true"><div className="onboarding-sky__sun" /><div className="onboarding-sky__island is-left" /><div className="onboarding-sky__island is-right" /></div>
      <div className="onboarding-layout">
        <aside className="onboarding-rail scroll" aria-label="Onboarding progress">
          <div className="onboarding-brand"><div className="crest" aria-hidden="true">♜</div><div><span>Control AI</span><b>Life journey</b></div></div>
          <div className="onboarding-rail__intro"><span className="eyebrow">Before the first crossroads</span><h1>Find your place on the map.</h1><p>A few details help the simulator begin from a life that feels like yours.</p></div>
          <ol className="onboarding-steps">{STEPS.map((item) => <li key={item.number} className={item.number === step ? "is-current" : item.number < step ? "is-complete" : ""} aria-current={item.number === step ? "step" : undefined}><span>{item.number < step ? "✓" : item.number}</span><div><b>{item.label}</b><small>{item.short}</small></div></li>)}</ol>
          <p className="onboarding-rail__privacy"><b>Private by design.</b> This prototype keeps your answers in this browser tab.</p>
        </aside>

        <section className="onboarding-card scroll" aria-labelledby="onboarding-title">
          <header className="onboarding-card__header"><div><span className="eyebrow">Chapter {step} of {STEPS.length} · {activeStep.short}</span><h2 id="onboarding-title">{activeStep.label}</h2></div><span className="onboarding-card__count">0{step}</span></header>
          {error && <p className="onboarding-error" role="alert">{error}</p>}

          {step === 1 && <form onSubmit={continueFromDemographics} className="onboarding-form">
            <div className="onboarding-lead"><h3>Where does your story begin?</h3><p>Age and location anchor taxes, costs, and milestones. Education helps us understand the roads already open to you.</p></div>
            <div className="onboarding-field-grid">
              <label className="onboarding-field"><span>Current age</span><input required min="16" max="80" inputMode="numeric" type="number" value={demographics.age} onChange={(event) => setDemographics({ ...demographics, age: event.target.value })} /><small>Your journey starts here</small></label>
              <label className="onboarding-field"><span>Country</span><select value={demographics.countryCode} onChange={(event) => setDemographics({ ...demographics, countryCode: event.target.value })}><option value="CA">Canada</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="AU">Australia</option><option value="OTHER">Another country</option></select></label>
              <label className="onboarding-field is-wide"><span>City, province, or region</span><input required autoComplete="address-level2" placeholder="e.g. Edmonton, Alberta" value={demographics.location} onChange={(event) => setDemographics({ ...demographics, location: event.target.value })} /><small>Used to estimate local costs and opportunities</small></label>
              <label className="onboarding-field is-wide"><span>Community type</span><select value={demographics.communityType} onChange={(event) => setDemographics({ ...demographics, communityType: event.target.value as CommunityType })}><option value="rural">Rural area</option><option value="small-town">Small town</option><option value="mid-size-city">Mid-size city</option><option value="large-city">Large city or metro area</option></select></label>
            </div>
            <fieldset className="onboarding-choice-group"><legend>Highest education completed</legend><p>Choose the closest match. There are no wrong paths here.</p><div className="education-grid">{EDUCATION_OPTIONS.map((option) => <button key={option.id} type="button" className={demographics.educationLevel === option.id ? "education-choice is-selected" : "education-choice"} aria-pressed={demographics.educationLevel === option.id} onClick={() => setDemographics({ ...demographics, educationLevel: option.id })}><span aria-hidden="true">{option.symbol}</span><b>{option.label}</b><small>{option.detail}</small></button>)}</div></fieldset>
            <label className="onboarding-field onboarding-field--study"><span>Field of study <i>optional</i></span><input placeholder="e.g. Business, nursing, computer science" value={demographics.fieldOfStudy} onChange={(event) => setDemographics({ ...demographics, fieldOfStudy: event.target.value })} /></label>
            <footer className="onboarding-actions"><span>Next: your work experience</span><button type="submit" className="ornate-btn is-primary">Continue along the path →</button></footer>
          </form>}

          {step === 2 && <form onSubmit={continueFromWork} className="onboarding-form">
            <div className="onboarding-lead onboarding-lead--with-toggle"><div><h3>What road have you travelled?</h3><p>Your recent work helps estimate starting income, growth, and the career forks you may encounter.</p></div><label className="experience-toggle"><input type="checkbox" checked={!work.hasPriorExperience} onChange={(event) => setWork({ ...work, hasPriorExperience: !event.target.checked, occupationId: event.target.checked ? "" : work.occupationId })} /><span>No prior work experience</span></label></div>
            {work.hasPriorExperience ? <>
              <label className="job-search"><span className="sr-only">Search occupations</span><b aria-hidden="true">⌕</b><input type="search" placeholder="Search jobs or fields..." value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} /><small>{visibleOccupations.length} roles</small></label>
              <div className="job-grid" aria-label="Most recent occupation">{visibleOccupations.map((occupation) => <button key={occupation.id} type="button" aria-pressed={work.occupationId === occupation.id} className={work.occupationId === occupation.id ? "job-choice is-selected" : "job-choice"} onClick={() => setWork({ ...work, occupationId: occupation.id })}><span className="job-choice__symbol" aria-hidden="true">{occupation.symbol}</span><span className="job-choice__copy"><b>{occupation.title}</b><small>{occupation.sector}</small></span><span className="job-choice__pay"><small>Typical range</small><b>{occupation.pay}</b></span></button>)}{visibleOccupations.length === 0 && <p className="job-grid__empty">No exact matches. Try a broader field.</p>}</div>
              <div className="onboarding-field-grid onboarding-field-grid--work">
                <label className="onboarding-field"><span>Years in this kind of work</span><input min="0" max="60" step="0.5" inputMode="decimal" type="number" value={work.yearsExperience} onChange={(event) => setWork({ ...work, yearsExperience: event.target.value })} /></label>
                <label className="onboarding-field"><span>Compensation basis</span><select value={work.compensationBasis} onChange={(event) => setWork({ ...work, compensationBasis: event.target.value as CompensationBasis, grossPay: "" })}><option value="hourly">Hourly wage</option><option value="salary">Salary</option><option value="contract">Contract</option><option value="self-employed">Self-employed</option></select></label>
                <label className="onboarding-field"><span>{work.compensationBasis === "hourly" ? "Gross hourly rate" : `Gross pay per ${work.payCadence} period`} <i>optional</i></span><div className="money-input"><b aria-hidden="true">$</b><input min="0" inputMode="decimal" type="number" aria-label={work.compensationBasis === "hourly" ? "Gross hourly rate" : `Gross pay per ${work.payCadence} pay period`} value={work.grossPay} onChange={(event) => setWork({ ...work, grossPay: event.target.value })} /></div></label>
                {work.compensationBasis === "hourly" && <label className="onboarding-field"><span>Average paid hours each week</span><input min="1" max="112" step="0.5" inputMode="decimal" type="number" value={work.averageHoursPerWeek} onChange={(event) => setWork({ ...work, averageHoursPerWeek: event.target.value })} /><small>Used to estimate your starting monthly income</small></label>}
                <label className="onboarding-field"><span>Pay frequency</span><select value={work.payCadence} onChange={(event) => setWork({ ...work, payCadence: event.target.value as PayCadence })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option></select></label>
                <label className="onboarding-field"><span>Usual schedule</span><select value={work.scheduleKind} onChange={(event) => setWork({ ...work, scheduleKind: event.target.value as WorkScheduleKind })}><option value="standard">Standard weekdays</option><option value="part-time">Part time</option><option value="shift">Shift work</option><option value="rotation-7-7">7 days on / 7 off</option><option value="rotation-10-4">10 days on / 4 off</option><option value="variable">Variable or seasonal</option></select></label>
              </div>
              <label className="bonus-check"><input type="checkbox" checked={work.hasBonusOrCommission} onChange={(event) => setWork({ ...work, hasBonusOrCommission: event.target.checked })} /><span><b>I earned bonuses, tips, or commission</b><small>We will ask for details when building your income.</small></span></label>
              <label className="onboarding-field onboarding-field--study"><span>Anything else about this work? <i>optional</i></span><textarea rows={3} placeholder="Seasonal work, multiple jobs, time away from work..." value={work.notes} onChange={(event) => setWork({ ...work, notes: event.target.value })} /></label>
            </> : <div className="experience-empty"><span aria-hidden="true">✦</span><h4>Your path can begin here.</h4><p>We will start without employment history and help you explore school, training, and first-job routes.</p></div>}
            <footer className="onboarding-actions"><button type="button" className="onboarding-text-button" onClick={() => goToStep(1)}>← Back</button><button type="submit" className="ornate-btn is-primary">Review my starting point →</button></footer>
          </form>}

          {step === 3 && !completedProfile && <div className="onboarding-form onboarding-review">
            <div className="onboarding-lead"><h3>Your trailhead is ready.</h3><p>This becomes the opening state for your simulation. You can go back now, and every detail can still change later.</p></div>
            <div className="review-banner"><span aria-hidden="true">♜</span><div><small>Journey begins at</small><b>Age {demographics.age} · {demographics.location}</b></div></div>
            <div className="review-grid">
              <section><span className="eyebrow">Your beginnings</span><dl><div><dt>Community</dt><dd>{demographics.communityType.replaceAll("-", " ")}</dd></div><div><dt>Education</dt><dd>{EDUCATION_OPTIONS.find(({ id }) => id === demographics.educationLevel)?.label}</dd></div><div><dt>Field</dt><dd>{demographics.fieldOfStudy || "Not specified"}</dd></div></dl><button type="button" onClick={() => goToStep(1)}>Edit beginnings</button></section>
              <section><span className="eyebrow">Road travelled</span><dl><div><dt>Experience</dt><dd>{work.hasPriorExperience ? selectedOccupation?.title : "Starting fresh"}</dd></div><div><dt>Time in field</dt><dd>{work.hasPriorExperience ? `${work.yearsExperience || 0} years` : "None"}</dd></div><div><dt>Compensation</dt><dd>{work.hasPriorExperience ? `${work.compensationBasis} · ${work.payCadence}` : "Not applicable"}</dd></div></dl><button type="button" onClick={() => goToStep(2)}>Edit experience</button></section>
            </div>
            <aside className="review-impact"><b>What this shapes</b><span>Starting cash flow</span><span>Local living costs</span><span>Career opportunities</span><span>Education pathways</span></aside>
            <footer className="onboarding-actions"><button type="button" className="onboarding-text-button" onClick={() => goToStep(2)}>← Back</button><button type="button" className="ornate-btn is-primary is-gold" onClick={finishOnboarding}>Begin my journey →</button></footer>
          </div>}

          {step === 3 && completedProfile && <div className="onboarding-complete" aria-live="polite"><span className="onboarding-complete__mark" aria-hidden="true">✓</span><span className="eyebrow">Profile saved</span><h3>The road is waiting.</h3><p>Your starting profile is ready for the life simulation and is saved for this browser tab.</p><div><a className="ornate-btn is-primary is-gold" href="/">Enter the journey →</a><button type="button" className="onboarding-text-button" onClick={() => setCompletedProfile(null)}>Review again</button></div></div>}
        </section>
      </div>
    </main>
  );
}
