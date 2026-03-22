import { z } from "zod";

const nullableNumber = z.number().nullable().optional();
const nullableString = z.string().nullable().optional();
const nullableBoolean = z.boolean().nullable().optional();
const unknownArrayOrRecord = z.union([
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

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

export const intervalsMapLatLngSchema = z.array(z.number()).nullable();

export const intervalsActivityMapRouteSchema = z
  .object({
    athlete_id: nullableString,
    route_id: nullableNumber,
    name: nullableString,
    rename_activities: nullableBoolean,
    commute: nullableBoolean,
    tags: z.array(z.string()).optional(),
    description: nullableString,
    replaced_by_route_id: nullableNumber,
    latlngs: z.array(intervalsMapLatLngSchema).optional(),
  })
  .passthrough();

export const intervalsActivityMapWeatherTimeSchema = z
  .object({
    start_secs: nullableNumber,
    end_secs: nullableNumber,
    index: nullableNumber,
    temp: nullableNumber,
    feels_like: nullableNumber,
    humidity: nullableNumber,
    wind_speed: nullableNumber,
    wind_deg: nullableNumber,
    wind_gust: nullableNumber,
    rain: nullableNumber,
    showers: nullableNumber,
    snow: nullableNumber,
    clouds: nullableNumber,
    pressure: nullableNumber,
    weather_code: nullableNumber,
  })
  .passthrough();

export const intervalsActivityMapWeatherPointSchema = z
  .object({
    latitude: nullableNumber,
    longitude: nullableNumber,
    times: z.array(intervalsActivityMapWeatherTimeSchema).optional(),
  })
  .passthrough();

export const intervalsActivityMapClosestPointSchema = z
  .object({
    start_secs: nullableNumber,
    p1_index: nullableNumber,
    p2_index: nullableNumber,
    p3_index: nullableNumber,
  })
  .passthrough();

export const intervalsActivityMapWeatherSchema = z
  .object({
    points: z.array(intervalsActivityMapWeatherPointSchema).optional(),
    closest_points: z.array(intervalsActivityMapClosestPointSchema).optional(),
  })
  .passthrough();

export const intervalsActivityMapSchema = z
  .object({
    bounds: z.array(z.array(z.number())).nullable().optional(),
    latlngs: z.array(intervalsMapLatLngSchema).nullable().optional(),
    route: intervalsActivityMapRouteSchema.nullable().optional(),
    weather: intervalsActivityMapWeatherSchema.nullable().optional(),
  })
  .passthrough()
  .nullable();

export const intervalsActivityStreamAnomalySchema = z
  .object({
    start_index: z.number(),
    end_index: z.number(),
    value: z.number(),
    valueEnd: z.number(),
  })
  .passthrough();

export const intervalsActivityStreamSchema = z
  .object({
    type: z.string().min(1),
    name: nullableString,
    data: unknownArrayOrRecord,
    data2: unknownArrayOrRecord.nullable().optional(),
    valueTypeIsArray: nullableBoolean,
    anomalies: z
      .array(intervalsActivityStreamAnomalySchema)
      .nullable()
      .optional(),
    custom: nullableBoolean,
    allNull: nullableBoolean,
  })
  .passthrough();

export const intervalsActivityStreamsSchema = z.array(
  intervalsActivityStreamSchema,
);

export type IntervalsAthleteProfile = z.infer<
  typeof intervalsAthleteProfileSchema
>;
export type IntervalsActivityDiscovery = z.infer<
  typeof intervalsActivityDiscoverySchema
>;
export type IntervalsActivityDetail = z.infer<
  typeof intervalsActivityDetailSchema
>;
export type IntervalsActivityMap = z.infer<typeof intervalsActivityMapSchema>;
export type IntervalsActivityStream = z.infer<
  typeof intervalsActivityStreamSchema
>;
export type IntervalsActivityStreams = z.infer<
  typeof intervalsActivityStreamsSchema
>;
