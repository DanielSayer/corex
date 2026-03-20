# `GET /athlete/:athleteId`

## Raw request shape

| Name        | In   | Type     | Required |
| ----------- | ---- | -------- | -------- |
| `athleteId` | path | `string` | yes      |

Built URL:

`https://intervals.icu/api/v1/athlete/:athleteId`

## Response model

- Response is a JSON object.
- Extra fields may exist.
- `id` is required. Other fields below are optional.

### TypeScript shape

```ts
export type IntervalsAthleteProfileResponse = {
  id: string;
  name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  sex?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string | null;
  locale?: string | null;
  measurement_preference?: string | null;
  status?: string | null;
  visibility?: string | null;
  weight?: number | null;
  icu_weight?: number | null;
  icu_last_seen?: string | null;
  icu_activated?: string | null;
  strava_id?: number | null;
  strava_authorized?: boolean | null;
} & Record<string, unknown>;
```

## Example raw output

- [athlete-profile.example.json](./examples/athlete-profile.example.json)
