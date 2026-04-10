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
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { WorkoutCalendar } from "@/components/training-calendar/training-calendar";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { getBrowserTimeZone } from "@/lib/browser-timezone";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/tranining-calendar")({
  component: RouteComponent,
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
});

const DEFAULT_DATE = new Date();
function RouteComponent() {
  const [currentDate, setCurrentDate] = useState(DEFAULT_DATE);
  const [pendingLink, setPendingLink] = useState<{
    plannedDate: string;
    activityId: string;
  } | null>(null);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarEndExclusive = startOfDay(addDays(calendarEnd, 1));
  const timezone = getBrowserTimeZone();
  const monthQueryOptions = trpc.trainingCalendar.month.queryOptions(
    {
      from: calendarStart.toISOString(),
      to: calendarEndExclusive.toISOString(),
      timezone,
    },
    {
      staleTime: 1000 * 60 * 5,
    },
  );

  const { data, isLoading } = useQuery(monthQueryOptions);
  const linkActivity = useMutation({
    ...trpc.trainingCalendar.linkActivity.mutationOptions(),
    onSuccess: async () => {
      setPendingLink(null);
      await queryClient.invalidateQueries({
        queryKey: monthQueryOptions.queryKey,
      });
      toast.success("Activity linked to planned session");
    },
    onError: (error) => {
      setPendingLink(null);
      toast.error(error.message);
    },
  });

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
        plannedSessions={data?.plannedSessions ?? []}
        onLinkActivity={(plannedDate, activityId) => {
          setPendingLink({ plannedDate, activityId });
          void linkActivity.mutateAsync({
            plannedDate,
            activityId,
            timezone,
          });
        }}
        linkingActivityId={pendingLink?.activityId ?? null}
        linkingPlannedDate={pendingLink?.plannedDate ?? null}
      />
    </main>
  );
}
