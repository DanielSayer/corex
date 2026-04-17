import { z } from "zod";

import { isValidTimeZone } from "../goal-progress/timezones";

const isoDateSchema = z.iso.date();
const optionalNotesSchema = z.string().trim().max(500).optional();
const timezoneSchema = z.string().trim().min(1).refine(isValidTimeZone, {
  message: "Invalid timezone",
});

export const eventGoalSchema = z.object({
  type: z.literal("event_goal"),
  targetDistance: z.object({
    value: z.number().positive(),
    unit: z.enum(["km", "mi"]),
  }),
  targetDate: isoDateSchema,
  eventName: z.string().trim().min(1).max(120).optional(),
  targetTimeSeconds: z.number().int().positive().optional(),
  notes: optionalNotesSchema,
});

const distanceVolumeGoalSchema = z.object({
  type: z.literal("volume_goal"),
  metric: z.literal("distance"),
  period: z.enum(["week", "month"]),
  targetValue: z.number().positive(),
  unit: z.enum(["km", "mi"]),
  notes: optionalNotesSchema,
});

const timeVolumeGoalSchema = z.object({
  type: z.literal("volume_goal"),
  metric: z.literal("time"),
  period: z.enum(["week", "month"]),
  targetValue: z.number().positive(),
  unit: z.literal("minutes"),
  notes: optionalNotesSchema,
});

export const volumeGoalSchema = z.union([
  distanceVolumeGoalSchema,
  timeVolumeGoalSchema,
]);

export const trainingGoalSchema = z.union([eventGoalSchema, volumeGoalSchema]);

export const availabilityDaySchema = z
  .object({
    available: z.boolean(),
    maxDurationMinutes: z.number().int().min(15).max(300).nullable(),
  })
  .refine(
    (value) => value.available || value.maxDurationMinutes === null,
    "Unavailable days cannot define a max duration",
  );

export const weeklyAvailabilitySchema = z.object({
  monday: availabilityDaySchema,
  tuesday: availabilityDaySchema,
  wednesday: availabilityDaySchema,
  thursday: availabilityDaySchema,
  friday: availabilityDaySchema,
  saturday: availabilityDaySchema,
  sunday: availabilityDaySchema,
});

export const trainingSettingsInputSchema = z.object({
  availability: weeklyAvailabilitySchema,
  intervalsUsername: z.string().trim().min(1).max(255),
  intervalsApiKey: z.string().trim().min(1).max(512),
  timezone: timezoneSchema,
  automaticWeeklyPlanRenewalEnabled: z.boolean().optional(),
});

export const trainingPreferencesSchema = z.object({
  timezone: timezoneSchema,
  automaticWeeklyPlanRenewalEnabled: z.boolean(),
});

export const updateTimezoneInputSchema = z.object({
  timezone: timezoneSchema,
});

export const updateAutomaticWeeklyPlanRenewalInputSchema = z.object({
  enabled: z.boolean(),
});

export type TrainingGoal = z.infer<typeof trainingGoalSchema>;
export type WeeklyAvailability = z.infer<typeof weeklyAvailabilitySchema>;
export type TrainingSettingsInput = z.infer<typeof trainingSettingsInputSchema>;
export type TrainingPreferences = z.infer<typeof trainingPreferencesSchema>;
export type UpdateAutomaticWeeklyPlanRenewalInput = z.infer<
  typeof updateAutomaticWeeklyPlanRenewalInputSchema
>;
