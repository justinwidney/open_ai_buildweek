import { Suspense, lazy, useEffect, useState } from "react";
import { HomeScreen } from "./labs/home/HomeScreen";
import {
  ONBOARDING_PROFILE_STORAGE_KEY,
  type JourneyOnboardingProfile,
} from "./labs/onboarding/onboarding.types";
import "./journey.tokens.css";

// The home screen is the entry point, so it is the only screen that ships in
// the first bundle. The journey pulls in the panels, the engine and three.js --
// over a megabyte that used to block the first paint of a screen that needs
// none of it.
const DecisionJourney = lazy(() => import("./DecisionJourney"));
const OnboardingExperience = lazy(() => import("./labs/onboarding/JourneyKickoffExperience"));

/** Home is the front door; every new journey establishes its starting state. */
type AppScreen = "home" | "onboarding" | "journey";

function initialScreen(): AppScreen {
  const params = new URLSearchParams(window.location.search);
  if (params.get("editStart") === "1") return "onboarding";
  if (import.meta.env.DEV && params.get("skipHome") === "1") return "journey";
  return "home";
}

function readStoredOnboardingProfile(): JourneyOnboardingProfile | null {
  try {
    const serialized = sessionStorage.getItem(ONBOARDING_PROFILE_STORAGE_KEY);
    if (!serialized) return null;
    const candidate = JSON.parse(serialized) as Partial<JourneyOnboardingProfile>;
    return candidate.schemaVersion === 1 && candidate.demographics?.age ? candidate as JourneyOnboardingProfile : null;
  } catch {
    return null;
  }
}

export function App() {
  const [onboardingProfile, setOnboardingProfile] = useState(readStoredOnboardingProfile);
  const [screen, setScreen] = useState<AppScreen>(initialScreen);

  // Fetch the journey chunk while the reveal is still playing, so pressing
  // Start Journey does not trade the old white screen for a new wait.
  useEffect(() => {
    void import("./DecisionJourney");
    void import("./labs/onboarding/JourneyKickoffExperience");
  }, []);

  if (screen === "home") {
    return <HomeScreen onStart={() => setScreen("onboarding")} />;
  }

  // No fallback markup: index.html paints the sky before anything mounts, so a
  // chunk that is still in flight shows the sky rather than a white flash.
  return (
    <Suspense fallback={null}>
      {screen === "onboarding" ? (
        <OnboardingExperience
          initialProfile={onboardingProfile}
          onComplete={(profile) => {
            setOnboardingProfile(profile);
            setScreen("journey");
          }}
        />
      ) : (
        <DecisionJourney onboardingProfile={onboardingProfile} />
      )}
    </Suspense>
  );
}
