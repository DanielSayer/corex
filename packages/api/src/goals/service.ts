import { Effect } from "effect";

import type { TrainingGoal } from "../training-settings/contracts";
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
  };
}
