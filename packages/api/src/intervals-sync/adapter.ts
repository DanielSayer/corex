import type { IntervalsIcuClient } from "../integrations/intervals-icu";
export {
  createIntervalsIcuClient as createIntervalsAdapter,
  type IntervalsIcuClient as IntervalsAdapter,
  type IntervalsIcuCredentials as IntervalsCredentials,
} from "../integrations/intervals-icu";

export type IntervalsUpstreamPort = {
  getProfile: IntervalsIcuClient["getProfile"];
  listActivities: IntervalsIcuClient["listActivities"];
  getDetail: IntervalsIcuClient["getActivityDetail"];
  getMap: IntervalsIcuClient["getActivityMap"];
  getStreams: IntervalsIcuClient["getActivityStreams"];
};
