# `GET /athlete/:athleteId/activities`

## Raw request shape

| Name        | In    | Type     | Required | Notes                |
| ----------- | ----- | -------- | -------- | -------------------- |
| `athleteId` | path  | `string` | yes      | dynamic              |
| `oldest`    | query | `string` | no       | sent only if defined |
| `newest`    | query | `string` | no       | sent only if defined |

Built URL pattern:

`https://intervals.icu/api/v1/athlete/:athleteId/activities`

Example with query:

`https://intervals.icu/api/v1/athlete/:athleteId/activities?oldest=2026-01-01&newest=2026-01-31`

## Response model

- Response is a JSON array of activity event objects.
- Extra fields may exist on each event.

### TypeScript shape

```ts
export type IntervalsActivityEvent = {
  id: string;
  type: string;
} & Record<string, unknown>;

export type IntervalsAthleteActivitiesResponse = IntervalsActivityEvent[];
```

## Consumer example

```ts
const events = payload as IntervalsAthleteActivitiesResponse;

for (const event of events) {
  console.log(event.id, event.type);
}
```

## Example raw output

- [athlete-activities.example.json](./examples/athlete-activities.example.json)
