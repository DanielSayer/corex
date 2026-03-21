import { z } from "zod";

const nullableNumber = z.number().nullable().optional();
const nullableString = z.string().nullable().optional();

export const intervalsAthleteProfileSchema = z
  .object({
    id: z.string().min(1),
    name: nullableString,
    firstname: nullableString,
    lastname: nullableString,
    email: nullableString,
  })
  .passthrough();

export const intervalsActivityDiscoverySchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    start_date: nullableString,
    start_date_local: nullableString,
  })
  .passthrough();

export const intervalsAthleteActivitiesSchema = z.array(
  intervalsActivityDiscoverySchema,
);

export const intervalsActivityIntervalSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    type: nullableString,
    group_id: nullableString,
    zone: nullableNumber,
    intensity: nullableNumber,
    distance: nullableNumber,
    moving_time: nullableNumber,
    elapsed_time: nullableNumber,
    start_time: nullableNumber,
    end_time: nullableNumber,
    average_speed: nullableNumber,
    max_speed: nullableNumber,
    average_heartrate: nullableNumber,
    max_heartrate: nullableNumber,
    average_cadence: nullableNumber,
    average_stride: nullableNumber,
    total_elevation_gain: nullableNumber,
  })
  .passthrough();

export const intervalsActivityDetailSchema = z
  .object({
    id: z.string().min(1),
    icu_athlete_id: nullableString,
    type: nullableString,
    name: nullableString,
    source: nullableString,
    external_id: nullableString,
    start_date: nullableString,
    start_date_local: nullableString,
    analyzed: nullableString,
    icu_sync_date: nullableString,
    distance: nullableNumber,
    moving_time: nullableNumber,
    elapsed_time: nullableNumber,
    total_elevation_gain: nullableNumber,
    total_elevation_loss: nullableNumber,
    average_speed: nullableNumber,
    max_speed: nullableNumber,
    average_heartrate: nullableNumber,
    max_heartrate: nullableNumber,
    average_cadence: nullableNumber,
    average_stride: nullableNumber,
    calories: nullableNumber,
    device_name: nullableString,
    icu_training_load: nullableNumber,
    hr_load: nullableNumber,
    icu_intensity: nullableNumber,
    lthr: nullableNumber,
    athlete_max_hr: nullableNumber,
    stream_types: z.array(z.string()).optional(),
    icu_intervals: z.array(intervalsActivityIntervalSchema).optional(),
    icu_hr_zones: z.array(z.number()).nullable().optional(),
    icu_hr_zone_times: z.array(z.number()).nullable().optional(),
    interval_summary: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export type IntervalsAthleteProfile = z.infer<
  typeof intervalsAthleteProfileSchema
>;
export type IntervalsActivityDiscovery = z.infer<
  typeof intervalsActivityDiscoverySchema
>;
export type IntervalsActivityDetail = z.infer<
  typeof intervalsActivityDetailSchema
>;
