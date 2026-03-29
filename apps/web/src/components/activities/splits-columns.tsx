import { createColumnHelper } from "@tanstack/react-table";

import { cn } from "@/lib/utils";

import { DataTableColumnHeader } from "@/components/data-table/column-header";

import {
  EMPTY_VALUE,
  formatDistanceToKm,
  formatSecondsToHms,
  formatSpeedToKmPerHour,
} from "./utils/formatters";
import type { ActivitySplit } from "./utils/types";

type SplitsTableData = ActivitySplit & {
  lapNumber: number;
};

const columnHelper = createColumnHelper<SplitsTableData>();

const columns = [
  columnHelper.accessor("lapNumber", {
    cell: ({ row }) => row.original.lapNumber,
    enableHiding: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lap" />
    ),
    meta: {
      title: "Lap",
    },
  }),
  columnHelper.accessor("distance", {
    cell: ({ row }) =>
      formatDistanceToKm(row.original.distance, { showUnit: false }),
    header: () => <Header title="Distance" sub="km" />,
    meta: {
      title: "Distance",
    },
  }),
  columnHelper.accessor("startTime", {
    cell: ({ row }) =>
      row.original.startTime
        ? formatSecondsToHms(row.original.startTime)
        : "0:00",
    header: () => <Header title="Start Time" />,
    meta: {
      title: "Start Time",
    },
  }),
  columnHelper.accessor("elapsedTime", {
    cell: ({ row }) => formatSecondsToHms(row.original.elapsedTime),
    header: () => <Header title="Elapsed Time" />,
    meta: {
      title: "Elapsed Time",
    },
  }),
  columnHelper.accessor("movingTime", {
    cell: ({ row }) => formatSecondsToHms(row.original.movingTime),
    header: () => <Header title="Moving Time" />,
    meta: {
      title: "Moving Time",
    },
  }),
  columnHelper.accessor("endTime", {
    cell: ({ row }) => formatSecondsToHms(row.original.endTime),
    header: () => <Header title="End Time" />,
    meta: {
      title: "End Time",
    },
  }),
  columnHelper.accessor("averageSpeed", {
    cell: ({ row }) =>
      formatSpeedToKmPerHour(row.original.averageSpeed, { showUnit: false }),
    header: () => <Header title="Average Speed" sub="km/h" />,
    meta: {
      title: "Average Speed",
    },
  }),
  columnHelper.accessor("maxSpeed", {
    cell: ({ row }) =>
      formatSpeedToKmPerHour(row.original.maxSpeed, { showUnit: false }),
    header: () => <Header title="Max Speed" sub="km/h" />,
    meta: {
      title: "Max Speed",
    },
  }),
  columnHelper.accessor("averageHeartrate", {
    cell: ({ row }) =>
      row.original.averageHeartrate
        ? Math.round(row.original.averageHeartrate)
        : EMPTY_VALUE,
    header: () => <Header title="Average HR" sub="bpm" />,
    meta: {
      title: "Average Heartrate",
    },
  }),
  columnHelper.accessor("maxHeartrate", {
    cell: ({ row }) =>
      row.original.maxHeartrate
        ? Math.round(row.original.maxHeartrate)
        : EMPTY_VALUE,
    header: () => <Header title="Max HR" sub="bpm" />,
    meta: {
      title: "Max Heartrate",
    },
  }),
  columnHelper.accessor("zone", {
    cell: ({ row }) => row.original.zone ?? EMPTY_VALUE,
    header: () => <Header title="HR Zone" />,
    meta: {
      title: "HR Zone",
    },
  }),
  columnHelper.accessor("intensity", {
    cell: ({ row }) => row.original.intensity ?? EMPTY_VALUE,
    header: () => <Header title="Intensity" />,
    meta: {
      title: "Intensity",
    },
  }),
  columnHelper.accessor("averageCadence", {
    cell: ({ row }) =>
      row.original.averageCadence
        ? Math.round(row.original.averageCadence)
        : EMPTY_VALUE,
    header: () => <Header title="Cadence" sub="spm" />,
    meta: {
      title: "Average Cadence",
    },
  }),
  columnHelper.accessor("averageStride", {
    cell: ({ row }) =>
      row.original.averageStride
        ? row.original.averageStride.toFixed(2)
        : EMPTY_VALUE,
    header: () => <Header title="Stride Length" sub="m" />,
    meta: {
      title: "Average Stride",
    },
  }),
  columnHelper.accessor("totalElevationGain", {
    cell: ({ row }) =>
      row.original.totalElevationGain
        ? Math.round(row.original.totalElevationGain)
        : "0",
    header: () => <Header title="Elevation Gain" sub="m" />,
    meta: {
      title: "Total Elevation Gain",
    },
  }),
];

type HeaderProps = {
  sub?: string;
  title: string;
};

function Header({ sub, title }: HeaderProps) {
  return (
    <div className={cn("pb-1", { "pb-5": !sub })}>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground text-xs">{sub}</p>
    </div>
  );
}

export { columns };
