import { createFileRoute } from "@tanstack/react-router";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { WorkoutCalendar } from "@/components/training-calendar/training-calendar";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { getBrowserTimeZone } from "@/lib/browser-timezone";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/tranining-calendar")({
  component: RouteComponent,
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
});

const DEFAULT_DATE = new Date();
function RouteComponent() {
  const [currentDate, setCurrentDate] = useState(DEFAULT_DATE);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarEndExclusive = startOfDay(addDays(calendarEnd, 1));
  const timezone = getBrowserTimeZone();

  const { data, isLoading } = useQuery(
    trpc.activityHistory.calendar.queryOptions(
      {
        from: calendarStart.toISOString(),
        to: calendarEndExclusive.toISOString(),
        timezone,
      },
      {
        staleTime: 1000 * 60 * 5,
      },
    ),
  );

  return (
    <main className="mx-auto flex w-full flex-col gap-4 px-6 pb-12 md:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Training Plan</h1>
      <WorkoutCalendar
        loading={isLoading}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        monthStart={monthStart}
        monthEnd={monthEnd}
        activities={data?.activities ?? []}
        weeks={data?.weeks ?? []}
      />
    </main>
  );
}
