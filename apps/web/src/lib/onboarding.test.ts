import { describe, expect, it } from "bun:test";

import {
  buildTrainingSettingsInput,
  buildTrainingGoalInput,
  createGoalDraftFromTrainingGoal,
} from "./onboarding";

describe("onboarding goal transforms", () => {
  it("builds a training goal input from an event draft", () => {
    const result = buildTrainingGoalInput({
      type: "event_goal",
      targetDistanceValue: "21.1",
      targetDistanceUnit: "km",
      targetDate: "2026-05-10",
      eventName: "City Half",
      targetTimeHours: "1",
      targetTimeMinutes: "45",
      targetTimeSeconds: "0",
      notes: "A race goal",
    });

    expect(result.value).toEqual({
      type: "event_goal",
      targetDistance: {
        value: 21.1,
        unit: "km",
      },
      targetDate: "2026-05-10",
      eventName: "City Half",
      targetTimeSeconds: 6300,
      notes: "A race goal",
    });
  });

  it("creates an editable goal draft from a stored training goal", () => {
    expect(
      createGoalDraftFromTrainingGoal({
        type: "event_goal",
        targetDistance: {
          value: 10,
          unit: "km",
        },
        targetDate: "2026-05-10",
        eventName: "10k",
        targetTimeSeconds: 3723,
        notes: "Fast day",
      }),
    ).toEqual({
      type: "event_goal",
      targetDistanceValue: "10",
      targetDistanceUnit: "km",
      targetDate: "2026-05-10",
      eventName: "10k",
      targetTimeHours: "1",
      targetTimeMinutes: "2",
      targetTimeSeconds: "3",
      notes: "Fast day",
    });
  });

  it("builds training settings input without embedding the goal", () => {
    const result = buildTrainingSettingsInput({
      goal: {
        type: "event_goal",
        targetDistanceValue: "10",
        targetDistanceUnit: "km",
        targetDate: "2026-05-10",
        eventName: "10k",
        targetTimeHours: "",
        targetTimeMinutes: "",
        targetTimeSeconds: "",
        notes: "",
      },
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: false, maxDurationMinutes: 45 },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: false, maxDurationMinutes: 45 },
        friday: { available: true, maxDurationMinutes: 45 },
        saturday: { available: true, maxDurationMinutes: 90 },
        sunday: { available: false, maxDurationMinutes: 45 },
      },
      intervalsUsername: "runner@example.com",
      intervalsApiKey: "secret-key",
    });

    expect(result.value).toEqual({
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: false, maxDurationMinutes: null },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: false, maxDurationMinutes: null },
        friday: { available: true, maxDurationMinutes: 45 },
        saturday: { available: true, maxDurationMinutes: 90 },
        sunday: { available: false, maxDurationMinutes: null },
      },
      intervalsUsername: "runner@example.com",
      intervalsApiKey: "secret-key",
    });
  });
});
