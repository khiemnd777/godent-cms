/** Authentication user IDs are opaque text, including Better Auth IDs and retained UUID fixtures. */
export function normalizeUserIdentifier(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid user identifier');
  }
  return value;
}
