# `GET /activity/:activityId?intervals=true`

## Raw request shape

| Name | In | Type | Required | Value |
| --- | --- | --- | --- | --- |
| `activityId` | path | `string` | yes | dynamic |
| `intervals` | query | `"true"` | yes | always hardcoded |

Built URL:

`https://intervals.icu/api/v1/activity/:activityId?intervals=true`

## Response model

- Response is a JSON object.
- Extra fields may exist.
- `id` is required. Other fields below are optional.

### TypeScript shape

```ts
export type IntervalsActivityInterval = {
  id: string | number;
  type?: string | null;
  group_id?: string | null;
  zone?: number | null;
  intensity?: number | null;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  start_time?: number | null;
  end_time?: number | null;
  average_speed?: number | null;
  max_speed?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_cadence?: number | null;
  average_stride?: number | null;
  total_elevation_gain?: number | null;
} & Record<string, unknown>;

export type IntervalsActivityDetailResponse = {
  id: string;
  icu_athlete_id?: string | null;
  type?: string | null;
  name?: string | null;
  source?: string | null;
  external_id?: string | null;
  start_date?: string | null;
  start_date_local?: string | null;
  analyzed?: string | null;
  icu_sync_date?: string | null;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  total_elevation_gain?: number | null;
  total_elevation_loss?: number | null;
  average_speed?: number | null;
  max_speed?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_cadence?: number | null;
  average_stride?: number | null;
  calories?: number | null;
  device_name?: string | null;
  icu_training_load?: number | null;
  hr_load?: number | null;
  icu_intensity?: number | null;
  lthr?: number | null;
  athlete_max_hr?: number | null;
  stream_types?: string[];
  icu_intervals?: IntervalsActivityInterval[];
  icu_hr_zones?: number[] | null;
  icu_hr_zone_times?: number[] | null;
  interval_summary?: string[] | null;
} & Record<string, unknown>;
```

### Field table

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `id` | `string` | yes | no |
| `icu_athlete_id` | `string | null` | no | yes |
| `type` | `string | null` | no | yes |
| `name` | `string | null` | no | yes |
| `source` | `string | null` | no | yes |
| `external_id` | `string | null` | no | yes |
| `start_date` | `string | null` | no | yes |
| `start_date_local` | `string | null` | no | yes |
| `analyzed` | `string | null` | no | yes |
| `icu_sync_date` | `string | null` | no | yes |
| `distance` | `number | null` | no | yes |
| `moving_time` | `number | null` | no | yes |
| `elapsed_time` | `number | null` | no | yes |
| `total_elevation_gain` | `number | null` | no | yes |
| `total_elevation_loss` | `number | null` | no | yes |
| `average_speed` | `number | null` | no | yes |
| `max_speed` | `number | null` | no | yes |
| `average_heartrate` | `number | null` | no | yes |
| `max_heartrate` | `number | null` | no | yes |
| `average_cadence` | `number | null` | no | yes |
| `average_stride` | `number | null` | no | yes |
| `calories` | `number | null` | no | yes |
| `device_name` | `string | null` | no | yes |
| `icu_training_load` | `number | null` | no | yes |
| `hr_load` | `number | null` | no | yes |
| `icu_intensity` | `number | null` | no | yes |
| `lthr` | `number | null` | no | yes |
| `athlete_max_hr` | `number | null` | no | yes |
| `stream_types` | `string[]` | no | no |
| `icu_intervals` | `IntervalsActivityInterval[]` | no | no |
| `icu_hr_zones` | `number[] | null` | no | yes |
| `icu_hr_zone_times` | `number[] | null` | no | yes |
| `interval_summary` | `string[] | null` | no | yes |

### `icu_intervals[]`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `id` | `string | number` | yes | no |
| `type` | `string | null` | no | yes |
| `group_id` | `string | null` | no | yes |
| `zone` | `number | null` | no | yes |
| `intensity` | `number | null` | no | yes |
| `distance` | `number | null` | no | yes |
| `moving_time` | `number | null` | no | yes |
| `elapsed_time` | `number | null` | no | yes |
| `start_time` | `number | null` | no | yes |
| `end_time` | `number | null` | no | yes |
| `average_speed` | `number | null` | no | yes |
| `max_speed` | `number | null` | no | yes |
| `average_heartrate` | `number | null` | no | yes |
| `max_heartrate` | `number | null` | no | yes |
| `average_cadence` | `number | null` | no | yes |
| `average_stride` | `number | null` | no | yes |
| `total_elevation_gain` | `number | null` | no | yes |

## Consumer example

```ts
const detail = payload as IntervalsActivityDetailResponse;

const intervals = detail.icu_intervals ?? [];
const streamTypes = detail.stream_types ?? [];
const startDate = detail.start_date ? new Date(detail.start_date) : null;
```

## Example raw output

- [activity-detail.example.json](./examples/activity-detail.example.json)
