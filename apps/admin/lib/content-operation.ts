import { versionedFailure } from "./versioned-operation";
export function contentSaveFailure(status: number | undefined, code: string | undefined, previouslyUnknown: boolean, existingResource: boolean) {
  return { ...versionedFailure(status, code, previouslyUnknown), conflict: existingResource && status === 409 && code !== "QUOTA_EXCEEDED" };
}
