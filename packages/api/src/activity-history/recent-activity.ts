export type RecentActivityPreview = {
  id: string;
  name: string;
  startDate: string;
  distance: number;
  elapsedTime: number | null;
  averageHeartrate: number | null;
  routePreview: {
    latlngs: Array<number[] | null> | null;
  } | null;
};
