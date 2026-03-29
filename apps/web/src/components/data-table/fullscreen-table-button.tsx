import type { Table as ReactTable } from "@tanstack/react-table";
import { Maximize2Icon } from "lucide-react";

import { Button } from "@corex/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@corex/ui/components/dialog";

import { DataTable } from ".";

type FullscreenTableButtonProps<TData> = {
  description: string;
  table: ReactTable<TData>;
  title: string;
};

function FullscreenTableButton<TData>({
  description,
  table,
  title,
}: FullscreenTableButtonProps<TData>) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="icon" variant="ghost">
            <Maximize2Icon />
            <span className="sr-only">Expand table</span>
          </Button>
        }
      />
      <DialogContent className="w-full sm:max-w-[90vw]">
        <DialogHeader className="-mb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DataTable table={table} />
      </DialogContent>
    </Dialog>
  );
}

export { FullscreenTableButton };
