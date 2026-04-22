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
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-white/[0.05]">
          <Icon className="size-4 text-[#a8b1cb]" />
        </div>
        <div className="text-sm text-[#9ba3bf]">{label}</div>
      </div>
      <div className="font-medium text-white">{value}</div>
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
    <div className="rounded-[16px] border border-white/10 bg-[#111827] px-3 py-2 text-white shadow-none">
      <div className="text-xs font-medium tracking-[0.18em] text-[#8e96b5] uppercase">
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
        "flex flex-col gap-2 rounded-[24px] border border-dashed border-white/10 bg-white/[0.025] px-5 py-8 text-white",
        compact && "py-6",
      )}
    >
      <div className="font-medium">{title}</div>
      <div className="max-w-md text-sm leading-6 text-[#8f97b7]">
        {description}
      </div>
    </div>
  );
}

export function AnalyticsLoadingState() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-50 w-full rounded-[24px] bg-white/6" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
        <Skeleton className="h-74 w-full rounded-[20px] bg-white/6" />
        <Skeleton className="h-74 w-full rounded-[20px] bg-white/6" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-74 w-full rounded-[20px] bg-white/6" />
        <Skeleton className="h-74 w-full rounded-[20px] bg-white/6" />
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
  contentClassName,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-[20px] border border-white/8 bg-[#0d1320] py-0 text-white shadow-none",
        className,
      )}
    >
      <CardHeader className="gap-2 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
            {title}
          </CardTitle>
          <CardDescription className="text-sm text-[#8f97b7]">
            {description}
          </CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("px-5 py-5 md:px-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
