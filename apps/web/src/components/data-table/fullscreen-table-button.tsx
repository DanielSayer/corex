import { Button } from "@corex/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@corex/ui/components/dialog";
import type { Table as ReactTable } from "@tanstack/react-table";
import { Maximize2Icon } from "lucide-react";
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
      <DialogContent className="flex max-h-[80vh] w-full flex-col overflow-hidden sm:max-w-[90vw]">
        <DialogHeader className="-mb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          <DataTable table={table} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { FullscreenTableButton };
