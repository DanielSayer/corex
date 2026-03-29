import type { Table } from "@tanstack/react-table";
import { Columns3Icon } from "lucide-react";

import { Button } from "@corex/ui/components/button";
import { Checkbox } from "@corex/ui/components/checkbox";
import { Label } from "@corex/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@corex/ui/components/popover";

type ColumnVisibilityProps<TData> = {
  table: Table<TData>;
};

function ColumnVisibility<TData>({ table }: ColumnVisibilityProps<TData>) {
  const columns = table.getAllColumns();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button className="items-center" variant="ghost">
            <Columns3Icon /> Columns
          </Button>
        }
      />
      <PopoverContent align="end">
        <div>
          <p className="mb-1 text-base font-semibold">Show/Hide Columns</p>
          <div className="space-y-1">
            {columns.map((column) => {
              const metaData = column.columnDef.meta;
              const title =
                metaData && "title" in metaData
                  ? String(metaData.title)
                  : column.id;

              if (!column.getCanHide()) {
                return null;
              }

              return (
                <Label key={column.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(Boolean(value))
                    }
                  />
                  <span>{title}</span>
                </Label>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ColumnVisibility };
