import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";

import { columns } from "./splits-columns";
import type { ActivitySplit } from "./utils/types";

type SplitsTableProps = {
  splits: Array<ActivitySplit & { lapNumber: number }>;
};

function SplitsTable({ splits }: SplitsTableProps) {
  const createBaseTableOptions = () => ({
    columns,
    data: splits,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    ...createBaseTableOptions(),
    initialState: {
      columnVisibility: {
        averageSpeed: false,
        endTime: false,
        maxSpeed: false,
        movingTime: false,
      },
    },
  });

  const fullscreenTable = useReactTable(createBaseTableOptions());

  return (
    <div>
      <div className="-mb-4">
        <h2 className="text-3xl font-bold tracking-tight">Laps</h2>
        <p className="text-muted-foreground text-sm">
          Detailed lap data for your activity.
        </p>
      </div>
      <DataTable
        description="All of your detailed lap data."
        fullscreenTable={fullscreenTable}
        isExpandable
        table={table}
        title="Laps"
      />
    </div>
  );
}

export { SplitsTable };
