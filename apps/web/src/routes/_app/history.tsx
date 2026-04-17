import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircleIcon, ClockIcon } from "lucide-react";
import { useState } from "react";

import { LoadingWrapper } from "@/components/renderers";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { trpc } from "@/utils/trpc";
import type {
  IntervalsSyncRouterOutputs,
  PlannerRouterOutputs,
} from "@/utils/types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Separator } from "@corex/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@corex/ui/components/sheet";
import { Skeleton } from "@corex/ui/components/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@corex/ui/components/toggle-group";

export const Route = createFileRoute("/_app/history")({
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
  component: RouteComponent,
});

type SyncHistoryEvent =
  IntervalsSyncRouterOutputs["listEvents"]["items"][number];
type GenerationHistoryEvent =
  PlannerRouterOutputs["listGenerationEvents"]["items"][number];
type ActiveTab = "sync" | "generation";
type SelectedEvent =
  | { type: "sync"; event: SyncHistoryEvent }
  | { type: "generation"; event: GenerationHistoryEvent }
  | null;

function formatDateTime(value: string | null) {
  if (!value) {
    return "Still running";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatHistoryCoverage(value: SyncHistoryEvent["historyCoverage"]) {
  if (value === "initial_30d_window") {
    return "Initial 30 day import";
  }

  if (value === "incremental_from_cursor") {
    return "Incremental update";
  }

  return "No coverage recorded";
}

function statusVariant(status: "success" | "failure" | "in_progress") {
  if (status === "failure") {
    return "destructive";
  }

  if (status === "success") {
    return "secondary";
  }

  return "outline";
}

function statusLabel(status: "success" | "failure" | "in_progress") {
  if (status === "in_progress") {
    return "In progress";
  }

  return status === "success" ? "Success" : "Failure";
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton className="h-28 w-full rounded-lg" key={index} />
      ))}
    </div>
  );
}

function EmptyHistory({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Alert>
      <ClockIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/70 p-3">
      <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function SyncEventRow({
  event,
  onOpen,
}: {
  event: SyncHistoryEvent;
  onOpen: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-border/70 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(event.status)}>
            {statusLabel(event.status)}
          </Badge>
          <Badge variant="outline">
            {formatHistoryCoverage(event.historyCoverage)}
          </Badge>
          {event.warningSummaries.length > 0 ? (
            <Badge variant="outline">
              {event.warningSummaries.length} notes
            </Badge>
          ) : null}
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {formatDateTime(event.startedAt)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {event.totalImportedCount} processed, {event.totalSkippedCount}{" "}
            skipped, {event.totalFailedFetchCount} fetch issues
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={onOpen}>
        View details
      </Button>
    </div>
  );
}

function GenerationEventRow({
  event,
  onOpen,
}: {
  event: GenerationHistoryEvent;
  onOpen: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-border/70 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(event.status)}>
            {statusLabel(event.status)}
          </Badge>
          <Badge variant="outline">
            {event.generationMode ?? "Unknown mode"}
          </Badge>
          <Badge variant="outline">{event.planGoal ?? "No goal"}</Badge>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Week of {event.startDate}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(event.createdAt)} by {event.provider} /{" "}
            {event.model}
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={onOpen}>
        View details
      </Button>
    </div>
  );
}

function SyncHistoryList({
  events,
  onOpen,
}: {
  events: SyncHistoryEvent[];
  onOpen: (event: SyncHistoryEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <EmptyHistory
        title="No sync attempts yet"
        description="Intervals sync attempts will appear here after the first import starts."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((event) => (
        <SyncEventRow
          event={event}
          key={event.eventId}
          onOpen={() => onOpen(event)}
        />
      ))}
    </div>
  );
}

function GenerationHistoryList({
  events,
  onOpen,
}: {
  events: GenerationHistoryEvent[];
  onOpen: (event: GenerationHistoryEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <EmptyHistory
        title="No generation attempts yet"
        description="Planner generation attempts will appear here after a draft is requested."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((event) => (
        <GenerationEventRow
          event={event}
          key={event.eventId}
          onOpen={() => onOpen(event)}
        />
      ))}
    </div>
  );
}

function SyncDetails({ event }: { event: SyncHistoryEvent }) {
  return (
    <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
      {event.failureSummary ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Sync failed</AlertTitle>
          <AlertDescription>{event.failureSummary}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Started" value={formatDateTime(event.startedAt)} />
        <Metric label="Completed" value={formatDateTime(event.completedAt)} />
        <Metric label="Processed" value={event.totalImportedCount} />
        <Metric label="Skipped" value={event.totalSkippedCount} />
        <Metric label="Fetch issues" value={event.totalFailedFetchCount} />
        <Metric label="Maps stored" value={event.storedMapCount} />
      </div>
      <Separator />
      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Warning summaries</h3>
        {event.warningSummaries.length > 0 ? (
          event.warningSummaries.map((warning) => (
            <div
              className="rounded-lg border border-border/70 p-3"
              key={warning.code}
            >
              <div className="font-medium">{warning.code}</div>
              <div className="text-sm text-muted-foreground">
                {warning.message}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No sync warnings were recorded for this attempt.
          </p>
        )}
      </div>
    </div>
  );
}

function GenerationDetails({ event }: { event: GenerationHistoryEvent }) {
  return (
    <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
      {event.failureSummary ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>{event.failureSummary}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Created" value={formatDateTime(event.createdAt)} />
        <Metric label="Updated" value={formatDateTime(event.updatedAt)} />
        <Metric label="Start date" value={event.startDate} />
        <Metric label="Mode" value={event.generationMode ?? "Unknown"} />
        <Metric label="Provider" value={event.provider} />
        <Metric label="Model" value={event.model} />
      </div>
      <Separator />
      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Draft link</h3>
        <p className="text-sm text-muted-foreground">
          {event.weeklyPlanId
            ? `Linked draft: ${event.weeklyPlanId}`
            : "No draft was linked to this attempt."}
        </p>
      </div>
      <Separator />
      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Quality review</h3>
        {event.qualityReport ? (
          <div className="rounded-lg border border-border/70 p-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{event.qualityReport.status}</Badge>
              <Badge variant="outline">{event.qualityReport.mode}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {event.qualityReport.summary}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {event.qualityReport.warningCount} warnings,{" "}
              {event.qualityReport.blockingCount} blocking items
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No quality review was recorded for this attempt.
          </p>
        )}
      </div>
    </div>
  );
}

function EventSheet({
  selectedEvent,
  onOpenChange,
}: {
  selectedEvent: SelectedEvent;
  onOpenChange: (open: boolean) => void;
}) {
  const isSync = selectedEvent?.type === "sync";
  const title = isSync ? "Sync attempt" : "Generation attempt";
  const description = selectedEvent
    ? selectedEvent.type === "sync"
      ? `${statusLabel(selectedEvent.event.status)} at ${formatDateTime(
          selectedEvent.event.startedAt,
        )}`
      : `${statusLabel(selectedEvent.event.status)} for ${selectedEvent.event.startDate}`
    : "";

  return (
    <Sheet open={Boolean(selectedEvent)} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {selectedEvent?.type === "sync" ? (
          <SyncDetails event={selectedEvent.event} />
        ) : null}
        {selectedEvent?.type === "generation" ? (
          <GenerationDetails event={selectedEvent.event} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RouteComponent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("sync");
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent>(null);
  const syncHistory = useQuery(
    trpc.intervalsSync.listEvents.queryOptions({ limit: 20, offset: 0 }),
  );
  const generationHistory = useQuery(
    trpc.weeklyPlanning.listGenerationEvents.queryOptions({
      limit: 20,
      offset: 0,
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-12 md:px-8">
      <section className="flex flex-col gap-5 border-b border-border/70 pb-8">
        <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          History
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-3">
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Recent sync and planner attempts
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Review recent Intervals imports and planner generation attempts
              without exposing raw provider payloads or model context.
            </p>
          </div>
          <ToggleGroup
            value={[activeTab]}
            onValueChange={(value) => {
              const selected = value[0] as ActiveTab | undefined;
              if (selected) {
                setActiveTab(selected);
                setSelectedEvent(null);
              }
            }}
            variant="outline"
          >
            <ToggleGroupItem value="sync">Sync attempts</ToggleGroupItem>
            <ToggleGroupItem value="generation">
              Generation attempts
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      {activeTab === "sync" ? (
        <LoadingWrapper
          isLoading={syncHistory.isLoading}
          fallback={<HistorySkeleton />}
        >
          <SyncHistoryList
            events={syncHistory.data?.items ?? []}
            onOpen={(event) => setSelectedEvent({ type: "sync", event })}
          />
        </LoadingWrapper>
      ) : null}

      {activeTab === "generation" ? (
        <LoadingWrapper
          isLoading={generationHistory.isLoading}
          fallback={<HistorySkeleton />}
        >
          <GenerationHistoryList
            events={generationHistory.data?.items ?? []}
            onOpen={(event) => setSelectedEvent({ type: "generation", event })}
          />
        </LoadingWrapper>
      ) : null}

      <EventSheet
        selectedEvent={selectedEvent}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null);
          }
        }}
      />
    </main>
  );
}
