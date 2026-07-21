import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OnboardingExperience } from "./OnboardingLab";

const root = document.getElementById("onboarding-root");
if (!root) throw new Error("Missing #onboarding-root");

createRoot(root).render(<StrictMode><OnboardingExperience /></StrictMode>);
