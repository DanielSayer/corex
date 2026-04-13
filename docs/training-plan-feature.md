# Training Plan Feature

## Overview

The training plan feature helps a runner generate structured weekly training based on three main inputs:

- recent running history imported from Intervals
- weekly availability stored in training settings
- the goal and planning intent they choose in the planner

The current product is still a weekly planner rather than a full long-term training program manager, but it now supports rolling forward from one planned week into the next.

## What The Feature Does

From a user point of view, the feature works like this:

1. The runner connects training history and completes training settings.
2. They open the planner and choose the kind of week they want, such as general training or race-focused preparation.
3. They confirm the planning inputs needed for that week, including start date, long-run day, duration, and perceived ability.
4. The app generates a structured week with sessions laid out day by day.
5. That week is stored as a draft plan.
6. The training calendar shows planned sessions alongside completed activities.
7. After a week already exists, the app can generate the next chronological week using the previous plan plus the latest imported history.

The output is meant to feel like a realistic, coach-like week that fits the runner's current situation rather than a generic template.

## What The Plan Includes

Each generated weekly plan:

- covers seven consecutive days
- includes rest days where needed
- includes exactly one long run
- respects the runner's stated availability
- reflects recent consistency and training load
- is stored as structured sessions rather than prose-only output

For race-oriented planning, the feature also uses benchmark performance to shape the week more specifically.

## How The App Decides What To Recommend

The planner uses local imported history to estimate what is realistic right now.

In practice, that means it tries to:

- stay close to the runner's recent consistency and volume
- avoid overloading runners with limited or patchy history
- shape the week around the selected goal
- use more recent actual running history as the main progression signal
- preserve continuity from the previous planned week when generating the next one

The product intention remains coach-like guidance, not rigid automation.

## Drafts And Weekly Progression

Generated plans are stored as drafts.

From a product perspective, that means:

- the user can generate an initial weekly draft
- the user can generate the next chronological week after an existing plan
- earlier draft weeks are preserved instead of being overwritten
- each draft week is tied to its own calendar range
- the planner can build week-to-week continuity without pretending the plan has been finalized

This is now a renewable weekly drafting system, but it is still draft-based rather than a finalized training-plan lifecycle.

## How Renewal Works Today

The important current behavior is:

- renewal is plan-led, not date-led
- the next week starts immediately after the latest stored plan ends
- the app carries forward the previous plan's intent by default
- the app recomputes the new week using fresh local history and current settings
- if the runner comes back after a gap, the next generated week still follows the previous planned week chronologically

So the planner now supports progression from one week to the next, even though the broader lifecycle is still incomplete.

## Relationship To The Training Calendar

The training calendar no longer depends on one globally active draft.

Instead, it uses the plan that matches the dates being viewed. From a product point of view, this lets the runner:

- see the planned sessions for the relevant week in the calendar
- compare actual activity against the matching planned week
- link a completed activity to the planned workout for that date
- keep older planned weeks available without losing visibility into newer ones

This makes the planner feel more like an ongoing weekly system rather than a single temporary draft.

## What Is Not Yet Part Of The Current Experience

The following pieces are still not part of the shipped flow:

- editing an existing draft plan
- regenerating a specific existing draft in place
- confirming or finalizing a draft into a locked plan
- browsing a history of finalized plans
- automatic background weekly renewal
- a full multi-week program lifecycle with committed phases or blocks

## Product Summary

The current training plan feature is best understood as a renewable weekly planning assistant.

It helps a runner generate a structured week that reflects their goal, availability, and recent running history, then continue forward into the next week while preserving continuity. It already supports the core experience of week generation, next-week progression, and calendar comparison against completed training. It does not yet support editing, finalization, or a full draft-to-committed plan lifecycle.
