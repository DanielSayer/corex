import type { CredentialCrypto } from "./crypto";
import type { IntervalsAccountStore } from "./account-repository";
import {
  createIntervalsAccountPort,
  type IntervalsAccountPort,
} from "./account";

export type IntervalsAccountService = IntervalsAccountPort & {
  loadAccountForUser: IntervalsAccountPort["load"];
  recordResolvedAthleteIdentity: IntervalsAccountPort["saveResolvedAthlete"];
};

export function createIntervalsAccountService(options: {
  store: IntervalsAccountStore;
  crypto: CredentialCrypto;
}): IntervalsAccountService {
  const port = createIntervalsAccountPort(options);

  return {
    ...port,
    loadAccountForUser: port.load,
    recordResolvedAthleteIdentity: port.saveResolvedAthlete,
  };
}
