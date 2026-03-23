import { describe, expect, it } from "bun:test";

import { shouldRenderOnboardingStep } from "./onboarding-route";

describe("shouldRenderOnboardingStep", () => {
  it("keeps onboarding visible before settings are complete", () => {
    expect(shouldRenderOnboardingStep("not_started", "goal")).toBe(true);
    expect(shouldRenderOnboardingStep(undefined, "credentials")).toBe(true);
  });

  it("keeps the sync step visible after settings are saved", () => {
    expect(shouldRenderOnboardingStep("complete", "sync")).toBe(true);
  });

  it("hides earlier onboarding steps once settings are complete", () => {
    expect(shouldRenderOnboardingStep("complete", "goal")).toBe(false);
    expect(shouldRenderOnboardingStep("complete", "credentials")).toBe(false);
  });
});
