# Backlog: Route and Terrain Aware Planning

## Audit classification

Recommended new feature not covered by the current plans.

## Source

- `docs/interval-icu-api/activity-map.md` documents route, bounds, lat/lng, and weather payloads.
- The current sync schema stores imported activity maps and elevation metrics.
- Existing plans use recent history, availability, goals, and PRs, but not route/terrain patterns as planning inputs.

## Current evidence

- Imported activities can store map payloads.
- Activity detail pages render route previews and elevation/altitude analysis.
- Planner history snapshots include total elevation gain, but do not classify terrain or route patterns.

## Problem

The planner treats a 10 km flat run and a 10 km hilly trail-style run as mostly equivalent aside from elevation totals. That loses useful coaching context for long runs, hill workouts, race preparation, and load interpretation.

## User value

Users get plans that better match the terrain they actually run and the terrain their goal requires.

## Scope

- Derive route/terrain summaries from imported map and activity facts.
- Classify runs by elevation density, route repeatability, and potentially surface hints where available.
- Add terrain summary fields to planner history/performance context.
- Let race-oriented planning bias long-run and workout guidance based on terrain history.
- Show terrain context in activity history or analytics where useful.

## Non-goals

- Building a route planner.
- Recommending exact turn-by-turn routes.
- Relying on live map provider calls during planning.
- Weather-based workout prescription in the first slice.

## Acceptance criteria

- [ ] A local terrain summary can be derived from imported activity facts.
- [ ] Planner context can distinguish flat, rolling, and hilly recent history.
- [ ] Weekly planning can include terrain guidance without requiring live Intervals reads.
- [ ] Analytics can expose at least one terrain trend or summary.
- [ ] Tests cover route/map absence, malformed map data, and elevation-derived classification.

## Implementation notes

- Start with elevation density and total elevation because those fields already exist.
- Treat raw map/weather payloads as optional enhancements, not required inputs.
- Avoid storing provider-specific route concepts in planner contracts.

