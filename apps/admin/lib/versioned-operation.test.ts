import { describe, expect, it } from "bun:test";
import { prepareVersionedOperation, versionedFailure } from "./versioned-operation";

describe("versioned operation retry identity", () => {
  it("captures an independent payload and its expected version", () => {
    const input = { kind: "assign", assigneeUserId: "admin-two" };
    const attempt = prepareVersionedOperation(null, input, 7, () => "operation-one");
    input.assigneeUserId = "admin-three";
    expect(attempt).toEqual({ kind: "assign", assigneeUserId: "admin-two", expectedVersion: 7, operationId: "operation-one" });
  });
  it("reuses the original payload, version and operation ID until its result is known", () => {
    const input: { kind: string; assigneeUserId: string | null } = { kind: "assign", assigneeUserId: "admin-two" };
    const first = prepareVersionedOperation(null, input, 7, () => "operation-one");
    const retry = prepareVersionedOperation(first, { kind: "assign", assigneeUserId: null }, 8, () => "operation-two");
    expect(retry).toBe(first);
    expect(retry.expectedVersion).toBe(7);
    expect(retry.operationId).toBe("operation-one");
    expect(retry.assigneeUserId).toBe("admin-two");
  });
  it("starts a new identity only after the preceding attempt is resolved", () => {
    const next = prepareVersionedOperation(null, { kind: "assign", assigneeUserId: null }, 8, () => "operation-two");
    expect(next.operationId).toBe("operation-two");
    expect(next.expectedVersion).toBe(8);
  });
  it("retains an unknown operation across reauthentication and retries its original receipt", () => {
    const original = prepareVersionedOperation(null, { mode: "selected", recipientUserIds: ["admin-two"] }, 7, () => "operation-one");
    const lostResponse = versionedFailure(undefined, undefined, false);
    expect(lostResponse.unknown).toBe(true);
    const reauth = versionedFailure(403, "REAUTH_REQUIRED", lostResponse.unknown);
    expect(reauth.unknown).toBe(true); expect(reauth.retain).toBe(true);
    const retry = prepareVersionedOperation(reauth.retain ? original : null, { mode: "selected", recipientUserIds: ["admin-three"] }, 8, () => "operation-two");
    expect(retry).toBe(original); expect(retry.operationId).toBe("operation-one"); expect(retry.expectedVersion).toBe(7);
  });
  it("distinguishes an initial reauthentication denial and a definitive version conflict", () => {
    expect(versionedFailure(403, "REAUTH_REQUIRED", false)).toEqual({ unknown: false, retain: false });
    expect(versionedFailure(409, "VERSION_CONFLICT", true)).toEqual({ unknown: false, retain: false });
  });
});
