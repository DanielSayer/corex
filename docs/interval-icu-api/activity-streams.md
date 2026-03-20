# `GET /activity/:activityId/streams{ext}?types=...`

## Raw request shape

| Name | In | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| `activityId` | path | `string` | yes | dynamic |
| `types` | query | `string[]` | yes | repeated query param |
| `ext` | path suffix | `.json | .csv` | no | default `.json` |

Built URL pattern:

`https://intervals.icu/api/v1/activity/:activityId/streams{ext}?types=a&types=b`

Example:

`https://intervals.icu/api/v1/activity/:activityId/streams.json?types=distance&types=heartrate`

## Response model

- Docs below cover `.json` responses.
- `.csv` returns CSV text.
- Response is a JSON array of stream objects for `.json`.
- Extra fields may exist on each stream.
- `data` and `data2` can be arrays or objects.

### TypeScript shape

```ts
export type IntervalsActivityStreamData =
  | unknown[]
  | Record<string, unknown>;

export type IntervalsActivityStreamAnomaly = {
  start_index: number;
  end_index: number;
  value: number;
  valueEnd: number;
} & Record<string, unknown>;

export type IntervalsActivityStream = {
  type: string;
  name?: string | null;
  data: IntervalsActivityStreamData;
  data2?: IntervalsActivityStreamData | null;
  valueTypeIsArray?: boolean | null;
  anomalies?: IntervalsActivityStreamAnomaly[] | null;
  custom?: boolean | null;
  allNull?: boolean | null;
} & Record<string, unknown>;

export type IntervalsActivityStreamsResponse = IntervalsActivityStream[];
```

### Stream object

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `type` | `string` | yes | no |
| `name` | `string | null` | no | yes |
| `data` | `unknown[] | Record<string, unknown>` | yes | no |
| `data2` | `unknown[] | Record<string, unknown> | null` | no | yes |
| `valueTypeIsArray` | `boolean | null` | no | yes |
| `anomalies` | `IntervalsActivityStreamAnomaly[] | null` | no | yes |
| `custom` | `boolean | null` | no | yes |
| `allNull` | `boolean | null` | no | yes |

### `anomalies[]`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `start_index` | `number` | yes | no |
| `end_index` | `number` | yes | no |
| `value` | `number` | yes | no |
| `valueEnd` | `number` | yes | no |

## Consumer example

```ts
const streams = payload as IntervalsActivityStreamsResponse;

for (const stream of streams) {
  if (Array.isArray(stream.data)) {
    console.log(stream.type, stream.data.length);
  } else {
    console.log(stream.type, Object.keys(stream.data));
  }
}
```

## Example raw output

- [activity-streams.example.json](./examples/activity-streams.example.json)
