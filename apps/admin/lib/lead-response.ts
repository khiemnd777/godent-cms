import type { LeadCommandResult, LeadDetail, LeadHistoryPage } from "../../api/src/contracts/s05";
import { apiRequest } from "./access";
import { deadlineFromResponse, isCurrentResponse } from "./retention-input";

/** A private lead keeps the validity deadline measured from its original request. */
export interface LeadSnapshot { lead: LeadDetail; deadline: number }
export function leadFromSnapshot(snapshot: LeadSnapshot | null, now = Date.now()) {
  return snapshot && Number.isFinite(snapshot.deadline) && isCurrentResponse(snapshot.deadline, now) ? snapshot.lead : null;
}
export async function requestLeadSnapshot(path: string, options: Parameters<typeof apiRequest>[1] = {}, now = Date.now): Promise<LeadSnapshot | null> {
  const started = now();
  const response = await apiRequest<LeadDetail | LeadCommandResult>(path, options);
  const lead = "lead" in response ? response.lead : response;
  const snapshot = { lead, deadline: deadlineFromResponse(lead.serverTime, lead.validUntil, started) };
  return leadFromSnapshot(snapshot, now()) ? snapshot : null;
}

export interface LeadHistorySnapshot { page: LeadHistoryPage; deadline: number }
export function historyFromSnapshot(snapshot: LeadHistorySnapshot | null, now = Date.now()) {
  return snapshot && Number.isFinite(snapshot.deadline) && isCurrentResponse(snapshot.deadline, now) ? snapshot.page : null;
}
export async function requestLeadHistorySnapshot(path: string, options: Parameters<typeof apiRequest>[1] = {}, now = Date.now): Promise<LeadHistorySnapshot | null> {
  const started = now();
  const page = await apiRequest<LeadHistoryPage>(path, options);
  const snapshot = { page, deadline: deadlineFromResponse(page.serverTime, page.validUntil, started) };
  return historyFromSnapshot(snapshot, now()) ? snapshot : null;
}
export function mergeHistorySnapshot(previous: LeadHistorySnapshot | null, next: LeadHistorySnapshot, append: boolean, now = Date.now()): LeadHistorySnapshot {
  if (!append || !historyFromSnapshot(previous, now)) return next;
  return { page: { ...next.page, items: [...previous!.page.items, ...next.page.items] }, deadline: Math.min(previous!.deadline, next.deadline) };
}
