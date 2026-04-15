import type { ActivityCalendarQueryInput } from "../activity-history/activity-calendar";

export type TrainingCalendarMonthInput = Omit<
  ActivityCalendarQueryInput,
  "timezone"
>;

export type LinkTrainingCalendarActivityInput = {
  plannedDate: string;
  activityId: string;
};
