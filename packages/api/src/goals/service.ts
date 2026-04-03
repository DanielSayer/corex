import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import type { TrainingGoal } from "../training-settings/contracts";
import { getGoalStatus } from "./domain";
import type { GoalRepository, StoredGoal } from "./repository";
import { InvalidSettings } from "../training-settings/errors";
import type { TrainingSettingsRepository } from "../training-settings/repository";

type Clock = {
  now: () => Date;
};

export type GoalListItem = {
  id: string;
  status: "active" | "completed";
  goal: TrainingGoal;
  createdAt: string;
  updatedAt: string;
};

export type GoalsApi = {
  getForUser: (userId: string) => Effect.Effect<GoalListItem[], unknown>;
  createForUser: (
    userId: string,
    goal: TrainingGoal,
  ) => Effect.Effect<GoalListItem, unknown>;
  updateForUser: (
    userId: string,
    goalId: string,
    goal: TrainingGoal,
  ) => Effect.Effect<GoalListItem, unknown>;
};

type CreateGoalsApiOptions = {
  repo: GoalRepository;
  trainingSettingsRepo: Pick<TrainingSettingsRepository, "findByUserId">;
  clock?: Clock;
};

function toDateOnly(now: Date) {
  return now.toISOString().slice(0, 10);
}

function toGoalListItem(stored: StoredGoal, today: string): GoalListItem {
  return {
    id: stored.id,
    status: getGoalStatus(stored.goal, today),
    goal: stored.goal,
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString(),
  };
}

export function createGoalsApi(options: CreateGoalsApiOptions): GoalsApi {
  const clock = options.clock ?? { now: () => new Date() };

  function ensureTrainingSettings(userId: string) {
    return Effect.flatMap(
      options.trainingSettingsRepo.findByUserId(userId),
      (stored) =>
        stored
          ? Effect.succeed(stored)
          : Effect.fail(
              new InvalidSettings({
                message:
                  "Training settings must exist before a goal can be created or updated",
              }),
            ),
    );
  }

  return {
    getForUser(userId) {
      return Effect.map(options.repo.listByUserId(userId), (storedGoals) => {
        const today = toDateOnly(clock.now());
        return storedGoals.map((stored) => toGoalListItem(stored, today));
      });
    },
    createForUser(userId, goal) {
      return Effect.gen(function* () {
        yield* ensureTrainingSettings(userId);
        const created = yield* options.repo.create({
          id: randomUUID(),
          userId,
          goal,
        });

        return toGoalListItem(created, toDateOnly(clock.now()));
      });
    },
    updateForUser(userId, goalId, goal) {
      return Effect.gen(function* () {
        yield* ensureTrainingSettings(userId);
        const updated = yield* options.repo.update({
          id: goalId,
          userId,
          goal,
        });

        return toGoalListItem(updated, toDateOnly(clock.now()));
      });
    },
  };
}
