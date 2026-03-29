import type { HTMLAttributes } from "react";
import type { Column } from "@tanstack/react-table";
import { ArrowUpDownIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Button } from "@corex/ui/components/button";

type DataTableColumnHeaderProps<TData, TValue> =
  HTMLAttributes<HTMLDivElement> & {
    column: Column<TData, TValue>;
    title: string;
  };

function DataTableColumnHeader<TData, TValue>({
  className,
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }

  return (
    <Button
      className="-ml-3 h-8 px-3"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      variant="ghost"
    >
      <span>{title}</span>
      {column.getIsSorted() === "desc" ? (
        <ChevronDownIcon />
      ) : column.getIsSorted() === "asc" ? (
        <ChevronUpIcon />
      ) : (
        <ArrowUpDownIcon />
      )}
    </Button>
  );
}

export { DataTableColumnHeader };
