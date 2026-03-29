import { LayersIcon } from "lucide-react";

import { Button } from "@corex/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@corex/ui/components/popover";

import type { CustomLayer } from "./map-tiles";

const LAYER_OPTIONS: Record<CustomLayer, { label: string }> = {
  satellite: { label: "Satellite" },
  standard: { label: "Standard" },
} as const;

type MapLayerPickerProps = {
  layerMode: CustomLayer;
  setLayerMode: (layerMode: CustomLayer) => void;
};

function MapLayerPicker({ layerMode, setLayerMode }: MapLayerPickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="Toggle map layer"
            className="h-8 w-8 shadow-md"
            size="icon"
            variant="secondary"
          >
            <LayersIcon className="h-4 w-4" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-36 p-1.5">
        <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
          Map layer
        </p>
        <div className="flex flex-col gap-0.5">
          {Object.entries(LAYER_OPTIONS).map(([key, option]) => (
            <button
              key={key}
              className={`w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                layerMode === key
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
              onClick={() => setLayerMode(key as CustomLayer)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { MapLayerPicker };
