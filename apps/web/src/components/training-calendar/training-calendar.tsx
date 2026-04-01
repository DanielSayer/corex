import { cn } from "@/lib/utils";
import type { IntervalsSyncRouterOutputs } from "@/utils/types";
import { Button } from "@corex/ui/components/button";
import {
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  isToday,
  subMonths,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { WeekSummaryCell } from "./week-summary-cell";
import { WorkoutCard } from "./workout-card";

type CalendarActivity =
  IntervalsSyncRouterOutputs["calendar"]["activities"][number];
type CalendarWeek = IntervalsSyncRouterOutputs["calendar"]["weeks"][number];

type WorkoutCalendarProps = {
  loading: boolean;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  monthStart: Date;
  monthEnd: Date;
  activities: CalendarActivity[];
  weeks: CalendarWeek[];
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WorkoutCalendar({
  loading,
  currentDate,
  setCurrentDate,
  monthStart,
  monthEnd,
  activities,
  weeks,
}: WorkoutCalendarProps) {
  const calendarWeeks = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 },
  );

  const activitiesByDate = activities.reduce<
    Record<string, CalendarActivity[]>
  >((acc, activity) => {
    const key = format(new Date(activity.startDate), "yyyy-MM-dd");
    acc[key] = [...(acc[key] ?? []), activity];
    return acc;
  }, {});
  const weeksByStart = new Map(weeks.map((week) => [week.weekStart, week]));

  return (
    <div className="border-border/60 bg-background flex h-full flex-col overflow-hidden rounded-xl border shadow-sm">
      {/* Header */}
      <div className="border-border/60 bg-card flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="border-border/50 bg-background flex items-center gap-1 rounded-md border p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <div className="bg-border/50 h-4 w-px" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => setCurrentDate(new Date())}
        >
          Today
        </Button>
      </div>

      {/* Day label row */}
      <div
        className="border-border/60 bg-muted/20 grid border-b"
        style={{ gridTemplateColumns: "180px repeat(7, minmax(0, 1fr))" }}
      >
        <div className="border-border/50 text-muted-foreground border-r py-2.5 text-center text-xs font-semibold tracking-wider uppercase">
          Weekly Totals
        </div>
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="border-border/50 text-muted-foreground border-r py-2.5 text-center text-xs font-semibold tracking-wider uppercase last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-background relative flex-1 overflow-y-auto">
        {loading && (
          <Loader2Icon className="absolute inset-0 top-1/4 left-1/2 size-10 animate-spin" />
        )}
        <div className="flex flex-col">
          {calendarWeeks.map((weekStart, index) => {
            const weekDays = eachDayOfInterval({
              start: weekStart,
              end: endOfWeek(weekStart, { weekStartsOn: 1 }),
            });
            const weekNum = getISOWeek(weekStart);
            const summary = weeksByStart.get(format(weekStart, "yyyy-MM-dd"));
            const isLastWeek = index === calendarWeeks.length - 1;

            return (
              <div
                key={weekStart.toISOString()}
                className={cn(
                  "grid min-h-35",
                  !isLastWeek && "border-border/50 border-b",
                )}
                style={{
                  gridTemplateColumns: "180px repeat(7, minmax(0, 1fr))",
                }}
              >
                {/* Week summary */}
                <WeekSummaryCell weekNum={weekNum} summary={summary} />

                {/* Day cells */}
                {weekDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayActivities = activitiesByDate[key] ?? [];
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={key}
                      className={cn(
                        "group border-border/50 relative border-r p-2 last:border-r-0",
                        !isCurrentMonth && "bg-muted/10",
                        isCurrentDay && "bg-primary/2",
                      )}
                    >
                      {/* Date Header */}
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors",
                            isCurrentDay
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : isCurrentMonth
                                ? "text-foreground group-hover:bg-muted"
                                : "text-muted-foreground/50",
                          )}
                        >
                          {format(day, "d")}
                        </span>
                      </div>

                      {/* Workouts container */}
                      <div className="flex flex-col gap-1.5">
                        {dayActivities.map((activity) => (
                          <WorkoutCard key={activity.id} workout={activity} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { WorkoutCalendar };
