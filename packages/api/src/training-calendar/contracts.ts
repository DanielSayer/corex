import type { ActivityCalendarQueryInput } from "../activity-history/activity-calendar";

export type TrainingCalendarMonthInput = ActivityCalendarQueryInput;

export type LinkTrainingCalendarActivityInput = {
  plannedDate: string;
  activityId: string;
  timezone: string;
};
