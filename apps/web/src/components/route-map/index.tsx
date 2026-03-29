import "leaflet/dist/leaflet.css";

import type { ReactNode } from "react";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";

import { Skeleton } from "@corex/ui/components/skeleton";

import { cn } from "@/lib/utils";
import { LoadingWrapper } from "@/components/renderers";

import {
  useGetLayerSelection,
  useSetLayerSelection,
} from "./layer-selection-actions";
import { MapLayerPicker } from "./map-layer-picker";
import { MAP_ATTRIBUTION, useGetMapTileUrl } from "./map-tiles";
import type { ActivityMapData } from "@/components/activities/utils/types";

type Coordinate = [number, number];

type RouteMapProps = {
  allowCustomLayers?: boolean;
  className?: string;
  disabled?: boolean;
  fallback?: ReactNode;
  mapData: ActivityMapData | null | undefined;
  showLayerToggle?: boolean;
};

function toLeafletBounds(bounds: number[][]) {
  return [
    [bounds[0][0], bounds[0][1]],
    [bounds[1][0], bounds[1][1]],
  ] as [Coordinate, Coordinate];
}

const mapDisabledProps = {
  boxZoom: false,
  doubleClickZoom: false,
  dragging: false,
  fadeAnimation: false,
  inertia: false,
  keyboard: false,
  markerZoomAnimation: false,
  scrollWheelZoom: false,
  touchZoom: false,
  zoomAnimation: false,
  zoomControl: false,
};

function RouteMap({
  allowCustomLayers = true,
  className,
  disabled,
  fallback = <EmptyRouteMap />,
  mapData,
  showLayerToggle = true,
}: RouteMapProps) {
  const { data: layerMode, isLoading } = useGetLayerSelection();
  const { mutate: setLayerMode } = useSetLayerSelection();
  const tileUrl = useGetMapTileUrl(layerMode ?? "standard", allowCustomLayers);

  if (!mapData) {
    return fallback;
  }

  const { bounds, latlngs } = mapData;
  const coordinates = latlngs
    .filter((point): point is [number, number] => Boolean(point))
    .map(([lat, lng]) => [lat, lng] as Coordinate);

  return (
    <div
      aria-label="Locked route map preview"
      className={cn("relative h-100 w-full", className)}
      role="img"
    >
      <LoadingWrapper
        fallback={<Skeleton className="h-full w-full rounded-sm" />}
        isLoading={isLoading}
      >
        <MapContainer
          bounds={toLeafletBounds(bounds)}
          className="h-full w-full overflow-hidden rounded-xl"
          style={{ height: "100%", width: "100%" }}
          {...(disabled ? mapDisabledProps : {})}
        >
          <TileLayer
            attribution={MAP_ATTRIBUTION}
            key={tileUrl}
            url={tileUrl}
          />
          <Polyline
            interactive={false}
            pathOptions={{ color: "#2563eb", opacity: 0.95, weight: 4 }}
            positions={coordinates}
          />
        </MapContainer>

        {showLayerToggle ? (
          <div className="absolute top-2 right-2">
            <MapLayerPicker
              layerMode={layerMode ?? "standard"}
              setLayerMode={setLayerMode}
            />
          </div>
        ) : null}
      </LoadingWrapper>
    </div>
  );
}

function EmptyRouteMap() {
  return (
    <div className="bg-muted/30 text-muted-foreground flex h-50 w-full items-center justify-center rounded-md border text-xs">
      Route unavailable
    </div>
  );
}

export { RouteMap };
