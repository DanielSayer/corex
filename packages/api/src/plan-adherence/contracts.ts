import { z } from "zod";

export const planAdherenceStatusSchema = z.enum([
  "planned",
  "completed",
  "moved",
  "partial",
  "missed",
]);

export const planAdherenceActivitySchema = z
  .object({
    activityId: z.string().min(1),
    name: z.string().min(1),
    startDate: z.iso.datetime(),
    localDate: z.iso.date(),
    distanceMeters: z.number().nonnegative(),
    durationSeconds: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const planAdherenceSessionSchema = z
  .object({
    plannedDate: z.iso.date(),
    status: planAdherenceStatusSchema,
    sessionType: z.enum(["easy_run", "long_run", "workout"]),
    title: z.string().min(1),
    plannedDistanceMeters: z.number().nonnegative().nullable(),
    plannedDurationSeconds: z.number().int().nonnegative(),
    actualLocalDate: z.iso.date().nullable(),
    linkedActivity: planAdherenceActivitySchema.nullable(),
    distanceCompletionRatio: z.number().nonnegative().nullable(),
    durationCompletionRatio: z.number().nonnegative().nullable(),
    targetCompletionRatio: z.number().min(0).max(1),
  })
  .strict();

export const planAdherenceExtraSessionSchema = z
  .object({
    activityId: z.string().min(1),
    name: z.string().min(1),
    startDate: z.iso.datetime(),
    localDate: z.iso.date(),
    distanceMeters: z.number().nonnegative(),
    durationSeconds: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const planAdherenceTotalsSchema = z
  .object({
    plannedSessionCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    movedCount: z.number().int().nonnegative(),
    partialCount: z.number().int().nonnegative(),
    missedCount: z.number().int().nonnegative(),
    plannedCount: z.number().int().nonnegative(),
    extraCount: z.number().int().nonnegative(),
    adheredSessionRatio: z.number().min(0).max(1).nullable(),
    targetCompletionRatio: z.number().min(0).max(1).nullable(),
    plannedDistanceMeters: z.number().nonnegative(),
    completedDistanceMeters: z.number().nonnegative(),
    plannedDurationSeconds: z.number().int().nonnegative(),
    completedDurationSeconds: z.number().int().nonnegative(),
  })
  .strict();

export const planAdherenceSummarySchema = z
  .object({
    planId: z.string().min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    timezone: z.string().min(1),
    currentLocalDate: z.iso.date(),
    sessions: z.array(planAdherenceSessionSchema),
    extras: z.array(planAdherenceExtraSessionSchema),
    totals: planAdherenceTotalsSchema,
  })
  .strict();

export const summaryForPlanInputSchema = z
  .object({
    planId: z.string().trim().min(1),
  })
  .strict();

export type PlanAdherenceStatus = z.infer<typeof planAdherenceStatusSchema>;
export type PlanAdherenceActivity = z.infer<typeof planAdherenceActivitySchema>;
export type PlanAdherenceSession = z.infer<typeof planAdherenceSessionSchema>;
export type PlanAdherenceExtraSession = z.infer<
  typeof planAdherenceExtraSessionSchema
>;
export type PlanAdherenceTotals = z.infer<typeof planAdherenceTotalsSchema>;
export type PlanAdherenceSummary = z.infer<typeof planAdherenceSummarySchema>;
export type SummaryForPlanInput = z.infer<typeof summaryForPlanInputSchema>;
