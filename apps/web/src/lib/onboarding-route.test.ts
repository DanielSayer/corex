import { describe, expect, it } from "bun:test";

import { shouldRenderOnboardingStep } from "./onboarding-route";

describe("shouldRenderOnboardingStep", () => {
  it("keeps onboarding visible before settings are complete", () => {
    expect(shouldRenderOnboardingStep("not_started", "goal", false)).toBe(true);
    expect(shouldRenderOnboardingStep(undefined, "credentials", false)).toBe(
      true,
    );
  });

  it("keeps the sync step visible after settings are saved", () => {
    expect(shouldRenderOnboardingStep("complete", "sync", false)).toBe(true);
  });

  it("hides earlier onboarding steps once settings are complete", () => {
    expect(shouldRenderOnboardingStep("complete", "goal", false)).toBe(false);
    expect(shouldRenderOnboardingStep("complete", "credentials", false)).toBe(
      false,
    );
  });

  it("keeps onboarding visible after completion when the user is still in the same session", () => {
    expect(shouldRenderOnboardingStep("complete", "sync", true)).toBe(true);
    expect(shouldRenderOnboardingStep("complete", "credentials", true)).toBe(
      true,
    );
  });
});
