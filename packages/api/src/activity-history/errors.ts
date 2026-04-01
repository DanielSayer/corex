export class ActivityHistoryPersistenceFailure extends Error {
  cause: unknown;

  constructor(options: { message: string; cause: unknown }) {
    super(options.message);
    this.name = "ActivityHistoryPersistenceFailure";
    this.cause = options.cause;
  }
}
