import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Button } from "@corex/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
import { Input } from "@corex/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@corex/ui/components/select";
import { formatGoalLabel, type PlannerFormState } from "@/lib/planner";

import {
  ESTIMATED_RACE_DISTANCES,
  LONG_RUN_DAYS,
  USER_PERCEIVED_ABILITIES,
} from "./planner-constants";
import { PlannerField } from "./planner-field";

type GoalCandidate = Parameters<typeof formatGoalLabel>[0];

type PlannerGenerateDraftCardProps = {
  form: PlannerFormState;
  goalCandidates: GoalCandidate[];
  raceTimeSeconds: number | null;
  isLowHistoryMode: boolean;
  errorMessage: string | null;
  isGenerating: boolean;
  onGenerateDraft: () => void;
  onFormChange: (
    updater: (current: PlannerFormState) => PlannerFormState,
  ) => void;
};

export function PlannerGenerateDraftCard(props: PlannerGenerateDraftCardProps) {
  const isSubmitDisabled =
    props.isGenerating ||
    !props.raceTimeSeconds ||
    props.form.goalId.length === 0 ||
    props.form.startDate.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate draft</CardTitle>
        <CardDescription>
          Select one goal and confirm the benchmark inputs that should steer
          this week.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <PlannerField label="Goal">
            <Select
              value={props.form.goalId}
              onValueChange={(value) =>
                value
                  ? props.onFormChange((current) => ({
                      ...current,
                      goalId: value,
                    }))
                  : undefined
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                {props.goalCandidates.map((goal) => (
                  <SelectItem key={goal.id} value={goal.id}>
                    {formatGoalLabel(goal)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PlannerField>

          <PlannerField label="Start date">
            <Input
              type="date"
              value={props.form.startDate}
              onChange={(event) =>
                props.onFormChange((current) => ({
                  ...current,
                  startDate: event.currentTarget.value,
                }))
              }
            />
          </PlannerField>

          <PlannerField label="Long-run day">
            <Select
              value={props.form.longRunDay}
              onValueChange={(value) =>
                value
                  ? props.onFormChange((current) => ({
                      ...current,
                      longRunDay: value,
                    }))
                  : undefined
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {LONG_RUN_DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PlannerField>

          <PlannerField label="Plan duration (weeks)">
            <Input
              type="number"
              min="1"
              max="24"
              value={props.form.planDurationWeeks}
              onChange={(event) =>
                props.onFormChange((current) => ({
                  ...current,
                  planDurationWeeks: event.currentTarget.value,
                }))
              }
            />
          </PlannerField>

          <PlannerField label="User-perceived ability">
            <Select
              value={props.form.userPerceivedAbility}
              onValueChange={(value) =>
                value
                  ? props.onFormChange((current) => ({
                      ...current,
                      userPerceivedAbility: value,
                    }))
                  : undefined
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select ability" />
              </SelectTrigger>
              <SelectContent>
                {USER_PERCEIVED_ABILITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PlannerField>

          <PlannerField label="Estimated race distance">
            <Select
              value={props.form.estimatedRaceDistance}
              onValueChange={(value) =>
                value
                  ? props.onFormChange((current) => ({
                      ...current,
                      estimatedRaceDistance: value,
                    }))
                  : undefined
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select race distance" />
              </SelectTrigger>
              <SelectContent>
                {ESTIMATED_RACE_DISTANCES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PlannerField>

          <PlannerField label="Estimated race time">
            <Input
              placeholder="50:00 or 1:35:00"
              value={props.form.estimatedRaceTime}
              onChange={(event) =>
                props.onFormChange((current) => ({
                  ...current,
                  estimatedRaceTime: event.currentTarget.value,
                }))
              }
            />
          </PlannerField>
        </div>

        {props.isLowHistoryMode ? (
          <Alert>
            <AlertTitle>Low-history mode</AlertTitle>
            <AlertDescription>
              corex found some local history, but not enough to fully trust the
              snapshot threshold. Your manual benchmark inputs will carry more
              weight in this generation.
            </AlertDescription>
          </Alert>
        ) : null}

        {props.errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Generation failed</AlertTitle>
            <AlertDescription>{props.errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            A valid race time is required to generate the draft.
          </div>
          <Button disabled={isSubmitDisabled} onClick={props.onGenerateDraft}>
            {props.isGenerating ? "Generating..." : "Generate draft"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
