import { useTheme } from "../theme-provider";

type Theme = "light" | "dark";

const MAP_TILES = {
  dark: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  light: "https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png",
  satellite:
    "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.png",
} as const;

const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type CustomLayer =
  | "standard"
  | Exclude<keyof typeof MAP_TILES, "dark" | "light">;

function useGetMapTileUrl(
  selectedLayer: CustomLayer,
  allowCustomLayers: boolean,
) {
  const { resolvedTheme } = useTheme();
  const userMode = (resolvedTheme as Theme) ?? "light";

  if (!allowCustomLayers || selectedLayer === "standard") {
    return MAP_TILES[userMode];
  }

  return MAP_TILES[selectedLayer];
}

export { MAP_ATTRIBUTION, useGetMapTileUrl };
export type { CustomLayer };
