import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CustomLayer } from "./map-tiles";

const PREFERRED_MAP_KEY = "preferred-map-type";

function useGetLayerSelection() {
  return useQuery({
    queryFn: () => {
      const preferredMapType = localStorage.getItem(PREFERRED_MAP_KEY);
      return (preferredMapType as CustomLayer) ?? "standard";
    },
    queryKey: [PREFERRED_MAP_KEY],
  });
}

function useSetLayerSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layerMode: CustomLayer) => {
      localStorage.setItem(PREFERRED_MAP_KEY, layerMode);
      queryClient.setQueryData([PREFERRED_MAP_KEY], layerMode);

      return Promise.resolve();
    },
  });
}

export { useGetLayerSelection, useSetLayerSelection };
