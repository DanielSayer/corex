import { Effect } from "effect";

import type { TrainingGoal } from "../training-settings/contracts";
import { InvalidSettings } from "../training-settings/errors";
import type {
  StoredTrainingSettings,
  TrainingSettingsRepository,
} from "../training-settings/repository";

export type GoalListItem = {
  id: string;
  status: "active";
  goal: TrainingGoal;
  createdAt: string;
  updatedAt: string;
};

export type GoalsApi = {
  getForUser: (userId: string) => Effect.Effect<GoalListItem[], unknown>;
  updateForUser: (
    userId: string,
    goal: TrainingGoal,
  ) => Effect.Effect<GoalListItem, unknown>;
};

type CreateGoalsApiOptions = {
  repo: TrainingSettingsRepository;
};

function toGoalListItem(stored: StoredTrainingSettings): GoalListItem {
  return {
    id: `${stored.userId}:${stored.createdAt.toISOString()}`,
    status: "active",
    goal: stored.goal,
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString(),
  };
}

export function createGoalsApi(options: CreateGoalsApiOptions): GoalsApi {
  return {
    getForUser(userId) {
      return Effect.map(options.repo.findByUserId(userId), (stored) =>
        stored ? [toGoalListItem(stored)] : [],
      );
    },
    updateForUser(userId, goal) {
      return Effect.gen(function* () {
        const stored = yield* options.repo.findByUserId(userId);

        if (!stored) {
          return yield* Effect.fail(
            new InvalidSettings({
              message:
                "Training settings must exist before a goal can be updated",
            }),
          );
        }

        const updated = yield* options.repo.upsert({
          userId,
          goal,
          availability: stored.availability,
          intervalsUsername: stored.intervalsCredential.username,
          intervalsCredential: {
            ciphertext: stored.intervalsCredential.ciphertext,
            iv: stored.intervalsCredential.iv,
            tag: stored.intervalsCredential.tag,
            keyVersion: stored.intervalsCredential.keyVersion,
          },
        });

        return toGoalListItem(updated);
      });
    },
  };
}
