# Intervals.icu API

Docs here cover the Intervals.icu endpoints used by this repo.

## Base

- Base URL: `https://intervals.icu/api/v1`
- Auth: HTTP Basic auth
- Content type: `application/json`

Auth header shape:

```text
Authorization: Basic base64("<username>:<apiKey>")
```

## Type notes

- Fields marked optional may be omitted.
- Fields marked nullable may be `null`.
- `ACTIVITY.STREAMS(..., { ext: ".csv" })` returns CSV, not JSON. JSON shapes below apply to `.json`.

## Endpoint list

| Builder | Built endpoint | Builder input params | Raw response docs | Example |
| --- | --- | --- | --- | --- |
| `ATHLETE.PROFILE(athleteId)` | `GET /athlete/:athleteId` | `athleteId: string` | [athlete-profile.md](./athlete-profile.md) | [athlete-profile.example.json](./examples/athlete-profile.example.json) |
| `ATHLETE.ACTIVITIES(athleteId, { oldest?, newest? })` | `GET /athlete/:athleteId/activities` | `athleteId: string`, `oldest?: string`, `newest?: string` | [athlete-activities.md](./athlete-activities.md) | [athlete-activities.example.json](./examples/athlete-activities.example.json) |
| `ACTIVITY.DETAIL(activityId)` | `GET /activity/:activityId?intervals=true` | `activityId: string` | [activity-detail.md](./activity-detail.md) | [activity-detail.example.json](./examples/activity-detail.example.json) |
| `ACTIVITY.MAP(activityId)` | `GET /activity/:activityId/map` | `activityId: string` | [activity-map.md](./activity-map.md) | [activity-map.example.json](./examples/activity-map.example.json) |
| `ACTIVITY.STREAMS(activityId, { types, ext? })` | `GET /activity/:activityId/streams{ext}?types=...` | `activityId: string`, `types: string[]`, `ext?: ".json" | ".csv"` | [activity-streams.md](./activity-streams.md) | [activity-streams.example.json](./examples/activity-streams.example.json) |

## Request encoding notes

- `ATHLETE.ACTIVITIES` only sends `oldest` if defined.
- `ATHLETE.ACTIVITIES` only sends `newest` if defined.
- `ACTIVITY.DETAIL` always sends `intervals=true`.
- `ACTIVITY.STREAMS` encodes `types` as repeated query params, eg `?types=distance&types=heartrate`.
- `ACTIVITY.STREAMS` defaults `ext` to `.json`.

## Consumer guidance

If consuming raw fetch output directly:

```ts
const response = await fetch(url, { headers: { Authorization: basicAuth } });
const payload: unknown = await response.json();
```

Then model payloads with the TS aliases documented per endpoint below.
