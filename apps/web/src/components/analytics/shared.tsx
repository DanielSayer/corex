import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
import { Skeleton } from "@corex/ui/components/skeleton";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function SnapshotRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-background">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export function TooltipCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2 shadow-md">
      <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export function EmptyPanel({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[1.5rem] border border-dashed border-border/70 bg-muted/15 px-5 py-8",
        compact && "py-6",
      )}
    >
      <div className="font-medium">{title}</div>
      <div className="max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

export function AnalyticsLoadingState() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-104 w-full rounded-[2rem]" />
      <Skeleton className="h-104 w-full rounded-[2rem]" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <Skeleton className="h-80 w-full rounded-[2rem]" />
        <Skeleton className="h-80 w-full rounded-[2rem]" />
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
