# `GET /activity/:activityId/map`

## Raw request shape

| Name | In | Type | Required |
| --- | --- | --- | --- |
| `activityId` | path | `string` | yes |

Built URL:

`https://intervals.icu/api/v1/activity/:activityId/map`

## Response model

- Response may be `null`.
- Otherwise response is a JSON object.
- Extra fields may exist.
- Some coordinate arrays may contain `null` entries.

### TypeScript shape

```ts
export type IntervalsMapLatLng = number[] | null;

export type IntervalsActivityMapRoute = {
  athlete_id?: string | null;
  route_id?: number | null;
  name?: string | null;
  rename_activities?: boolean | null;
  commute?: boolean | null;
  tags?: string[];
  description?: string | null;
  replaced_by_route_id?: number | null;
  latlngs?: IntervalsMapLatLng[];
} & Record<string, unknown>;

export type IntervalsActivityMapWeatherTime = {
  start_secs?: number | null;
  end_secs?: number | null;
  index?: number | null;
  temp?: number | null;
  feels_like?: number | null;
  humidity?: number | null;
  wind_speed?: number | null;
  wind_deg?: number | null;
  wind_gust?: number | null;
  rain?: number | null;
  showers?: number | null;
  snow?: number | null;
  clouds?: number | null;
  pressure?: number | null;
  weather_code?: number | null;
} & Record<string, unknown>;

export type IntervalsActivityMapWeatherPoint = {
  latitude?: number | null;
  longitude?: number | null;
  times?: IntervalsActivityMapWeatherTime[];
} & Record<string, unknown>;

export type IntervalsActivityMapClosestPoint = {
  start_secs?: number | null;
  p1_index?: number | null;
  p2_index?: number | null;
  p3_index?: number | null;
} & Record<string, unknown>;

export type IntervalsActivityMapWeather = {
  points?: IntervalsActivityMapWeatherPoint[];
  closest_points?: IntervalsActivityMapClosestPoint[];
} & Record<string, unknown>;

export type IntervalsActivityMapResponse =
  | ({
      bounds?: number[][] | null;
      latlngs?: IntervalsMapLatLng[] | null;
      route?: IntervalsActivityMapRoute | null;
      weather?: IntervalsActivityMapWeather | null;
    } & Record<string, unknown>)
  | null;
```

### Top-level object

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `bounds` | `number[][] | null` | no | yes |
| `latlngs` | `Array<number[] | null> | null` | no | yes |
| `route` | `IntervalsActivityMapRoute | null` | no | yes |
| `weather` | `IntervalsActivityMapWeather | null` | no | yes |

### `route`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `athlete_id` | `string | null` | no | yes |
| `route_id` | `number | null` | no | yes |
| `name` | `string | null` | no | yes |
| `rename_activities` | `boolean | null` | no | yes |
| `commute` | `boolean | null` | no | yes |
| `tags` | `string[]` | no | no |
| `description` | `string | null` | no | yes |
| `replaced_by_route_id` | `number | null` | no | yes |
| `latlngs` | `Array<number[] | null>` | no | no |

### `weather`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `points` | `IntervalsActivityMapWeatherPoint[]` | no | no |
| `closest_points` | `IntervalsActivityMapClosestPoint[]` | no | no |

### `WeatherPoint`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `latitude` | `number | null` | no | yes |
| `longitude` | `number | null` | no | yes |
| `times` | `IntervalsActivityMapWeatherTime[]` | no | no |

### `WeatherTime`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `start_secs` | `number | null` | no | yes |
| `end_secs` | `number | null` | no | yes |
| `index` | `number | null` | no | yes |
| `temp` | `number | null` | no | yes |
| `feels_like` | `number | null` | no | yes |
| `humidity` | `number | null` | no | yes |
| `wind_speed` | `number | null` | no | yes |
| `wind_deg` | `number | null` | no | yes |
| `wind_gust` | `number | null` | no | yes |
| `rain` | `number | null` | no | yes |
| `showers` | `number | null` | no | yes |
| `snow` | `number | null` | no | yes |
| `clouds` | `number | null` | no | yes |
| `pressure` | `number | null` | no | yes |
| `weather_code` | `number | null` | no | yes |

### `ClosestPoint`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `start_secs` | `number | null` | no | yes |
| `p1_index` | `number | null` | no | yes |
| `p2_index` | `number | null` | no | yes |
| `p3_index` | `number | null` | no | yes |

## Consumer example

```ts
const map = payload as IntervalsActivityMapResponse;

if (map?.latlngs) {
  const points = map.latlngs.filter(
    (point): point is number[] => Array.isArray(point),
  );
  console.log(points.length);
}
```

## Example raw output

- [activity-map.example.json](./examples/activity-map.example.json)
