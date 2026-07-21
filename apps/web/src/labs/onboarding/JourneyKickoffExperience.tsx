import { useState, type FormEvent } from "react";
import "../lab.css";
import "../decision-travel/theme.css";
import "./OnboardingLab.css";
import {
  ONBOARDING_PROFILE_STORAGE_KEY,
  type JourneyOnboardingProfile,
} from "./onboarding.types";

export interface JourneyKickoffExperienceProps {
  initialProfile?: JourneyOnboardingProfile | null;
  onComplete: (profile: JourneyOnboardingProfile) => void;
}

function numeric(value: string) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

/** The two values required to establish the simulation's month-zero state. */
export default function JourneyKickoffExperience({ initialProfile, onComplete }: JourneyKickoffExperienceProps) {
  const [age, setAge] = useState(() => initialProfile?.demographics.age ? String(initialProfile.demographics.age) : "");
  const [netWorth, setNetWorth] = useState(() => initialProfile?.startingNetWorth != null ? String(initialProfile.startingNetWorth) : "");
  const [error, setError] = useState("");

  function begin(event: FormEvent) {
    event.preventDefault();
    const startingAge = numeric(age);
    const startingNetWorth = numeric(netWorth);
    if (!Number.isInteger(startingAge) || startingAge < 16 || startingAge > 100) return setError("Enter an age between 16 and 100.");
    if (!Number.isFinite(startingNetWorth) || Math.abs(startingNetWorth) > 100_000_000) return setError("Enter a net worth between -$100 million and $100 million.");

    const profile: JourneyOnboardingProfile = {
      schemaVersion: 1,
      completedAt: new Date().toISOString(),
      startingNetWorth,
      demographics: { age: startingAge, countryCode: "US", location: "", communityType: "mid-size-city", educationLevel: "high-school", fieldOfStudy: null },
      workExperience: {
        hasPriorExperience: false, occupationId: null, occupationTitle: null, yearsExperience: 0,
        compensationBasis: null, payCadence: null, scheduleKind: null, averageHoursPerWeek: null,
        grossHourlyRateCents: null, grossPayPerPeriodCents: null, hasBonusOrCommission: false, notes: null,
      },
    };

    sessionStorage.setItem(ONBOARDING_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    onComplete(profile);
  }

  return (
    <main className="onboarding-shell onboarding-shell--kickoff">
      <div className="onboarding-sky" aria-hidden="true"><div className="onboarding-sky__sun" /><div className="onboarding-sky__island is-left" /><div className="onboarding-sky__island is-right" /></div>
      <div className="onboarding-layout onboarding-layout--kickoff">
        <aside className="onboarding-rail scroll">
          <div className="onboarding-brand"><div className="crest" aria-hidden="true">♜</div><div><span>Conquer Your Path</span></div></div>
          <div className="onboarding-rail__intro"><span className="eyebrow">Before the first crossroads</span><h1>Choose your starting point.</h1><p>Two details place you on the map and establish your finances before your first decision.</p></div>
          <p className="onboarding-rail__privacy"><b>Private by design.</b> These values stay in this browser tab.</p>
        </aside>

        <section className="onboarding-card scroll" aria-labelledby="kickoff-title">
          <header className="onboarding-card__header"><div><span className="eyebrow">Your starting point</span><h2 id="kickoff-title">Where are you today?</h2></div><span className="onboarding-card__count">01</span></header>
          {error && <p className="onboarding-error" role="alert">{error}</p>}
          <form className="onboarding-form onboarding-form--kickoff" onSubmit={begin}>
            <div className="onboarding-lead"><h3>Kickstart your simulation.</h3><p>Your age sets the timeline. Your current net worth becomes the opening balance at month zero—before school, work, or any other path changes it.</p></div>
            <div className="onboarding-field-grid onboarding-field-grid--kickoff">
              <label className="onboarding-field"><span>Current age</span><input required autoFocus min="16" max="100" inputMode="numeric" type="number" value={age} onChange={(event) => setAge(event.target.value)} /><small>Whole years, from 16 to 100</small></label>
              <label className="onboarding-field"><span>Current net worth</span><div className="money-input"><b aria-hidden="true">$</b><input required min="-100000000" max="100000000" step="100" inputMode="decimal" type="number" aria-label="Current net worth in dollars" value={netWorth} onChange={(event) => setNetWorth(event.target.value)} /></div><small>Assets minus debts; negative values are okay</small></label>
            </div>
            <aside className="review-impact"><b>Your simulation will begin with</b><span>Age {numeric(age) || "—"}</span><span>{netWorth.trim() ? `$${numeric(netWorth).toLocaleString("en-US")}` : "—"} net worth</span><span>No decisions applied yet</span></aside>
            <footer className="onboarding-actions"><span>You can restart with new values later.</span><button type="submit" className="ornate-btn is-primary is-gold">Begin my journey →</button></footer>
          </form>
        </section>
      </div>
    </main>
  );
}
