export type VersionedOperation<T> = T & { operationId: string; expectedVersion: number };

/** A transport failure does not prove that the server rejected a command. */
export function prepareVersionedOperation<T extends object>(
  pending: VersionedOperation<T> | null,
  input: T,
  expectedVersion: number,
  createId: () => string = () => crypto.randomUUID(),
): VersionedOperation<T> {
  return pending ?? { ...structuredClone(input), operationId: createId(), expectedVersion };
}
export function versionedFailure(status: number | undefined, code: string | undefined, previouslyUnknown: boolean) {
  const unknown = status === undefined || status >= 500 || previouslyUnknown && code === "REAUTH_REQUIRED";
  return { unknown, retain: unknown };
}
