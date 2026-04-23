import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  BEST_EFFORT_TARGET_DISTANCES_METERS,
  type BestEffortDistance,
} from "@/components/activities/utils/best-efforts";
import {
  AnalyticsLoadingState,
  AnalyticsOverview,
  ConsistencyCard,
  CumulativeDistanceCard,
  DistanceTrendCard,
  OverallPrsCard,
  PrTrendCard,
  TrainingMixCard,
  type DistanceGranularity,
} from "@/components/analytics";
import { LoadingWrapper } from "@/components/renderers";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/analytics")({
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
  component: RouteComponent,
});

function RouteComponent() {
  const trainingSettings = useQuery(trpc.trainingSettings.get.queryOptions());
  const timezone = trainingSettings.data?.preferences.timezone ?? "UTC";
  const currentYear = useMemo(
    () =>
      Number(
        new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          timeZone: timezone,
        }).format(new Date()),
      ),
    [timezone],
  );
  const [requestedYear, setRequestedYear] = useState(currentYear);
  const [distanceGranularity, setDistanceGranularity] =
    useState<DistanceGranularity>("month");
  const requestedAnalytics = useQuery(
    trpc.analytics.get.queryOptions({
      year: requestedYear,
    }),
  );
  const fallbackYear = useMemo(() => {
    const availableYears = requestedAnalytics.data?.availableYears;

    if (availableYears?.length && !availableYears.includes(requestedYear)) {
      return availableYears.at(-1);
    }

    return undefined;
  }, [requestedAnalytics.data?.availableYears, requestedYear]);
  const fallbackAnalytics = useQuery(
    trpc.analytics.get.queryOptions(
      {
        year: fallbackYear ?? requestedYear,
      },
      {
        enabled: typeof fallbackYear === "number",
      },
    ),
  );
  const analytics =
    fallbackAnalytics.data && typeof fallbackYear === "number"
      ? fallbackAnalytics
      : requestedAnalytics;
  const selectedYear = fallbackYear ?? requestedYear;
  const availableYears =
    analytics.data?.availableYears.length &&
    analytics.data.availableYears.length > 0
      ? analytics.data.availableYears
      : [selectedYear];
  const [selectedPrDistance, setSelectedPrDistance] =
    useState<BestEffortDistance>(BEST_EFFORT_TARGET_DISTANCES_METERS[0]);

  const effectivePrDistance = analytics.data?.prTrends.distances.includes(
    selectedPrDistance,
  )
    ? selectedPrDistance
    : (analytics.data?.prTrends.distances[0] ??
      BEST_EFFORT_TARGET_DISTANCES_METERS[0]);
  const isLoading = requestedAnalytics.isLoading || fallbackAnalytics.isLoading;

  return (
    <main className="mx-auto flex w-full flex-col gap-8 px-4 pb-10 md:px-16">
      <AnalyticsOverview
        analytics={analytics.data}
        availableYears={availableYears}
        selectedYear={selectedYear}
        timezone={timezone}
        onYearChange={setRequestedYear}
      />
      <LoadingWrapper
        isLoading={isLoading}
        fallback={<AnalyticsLoadingState />}
      >
        {analytics.data ? (
          <div className="flex flex-col gap-5">
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)]">
              <OverallPrsCard data={analytics.data} />
              <PrTrendCard
                data={analytics.data}
                selectedDistance={effectivePrDistance}
                onDistanceChange={(value) =>
                  setSelectedPrDistance(Number(value) as BestEffortDistance)
                }
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <DistanceTrendCard
                data={analytics.data}
                distanceGranularity={distanceGranularity}
                onGranularityChange={(value) =>
                  setDistanceGranularity(value as DistanceGranularity)
                }
              />
              <CumulativeDistanceCard data={analytics.data} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <TrainingMixCard data={analytics.data} />
              <ConsistencyCard data={analytics.data} />
            </section>
          </div>
        ) : null}
      </LoadingWrapper>
    </main>
  );
}
