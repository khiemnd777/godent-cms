"use client";
import { useEffect, useRef, useState } from "react";
import { S05_ROUTES, type LeadCommand, type LeadDetail } from "../../api/src/contracts/s05";
import { ApiError } from "../lib/access";
import { leadFromSnapshot, requestLeadSnapshot, type LeadSnapshot } from "../lib/lead-response";
import { leadDenied, leadError } from "../lib/lead-presentation";
import { prepareVersionedOperation, versionedFailure } from "../lib/versioned-operation";
import { useSession } from "./session-provider";
import { useRetentionDeadline } from "./use-retention-deadline";

type CommandInput<T = LeadCommand> = T extends LeadCommand ? Omit<T, "operationId" | "expectedVersion"> : never;
export function useLeadCommand({ tenantId, lead, onChanged, onUnavailable }: {
  tenantId: string; lead: LeadDetail; onChanged: (snapshot: LeadSnapshot) => void; onUnavailable: (reason?: "expired") => void;
}) {
  const { data } = useSession();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [unknown, setUnknown] = useState(false); const [conflict, setConflict] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<LeadSnapshot | null>(null);
  const latest = leadFromSnapshot(latestSnapshot);
  const attempt = useRef<LeadCommand | null>(null); const pending = useRef<AbortController | null>(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort(); }; }, []);
  useRetentionDeadline(latestSnapshot?.deadline ?? Infinity, () => { setLatestSnapshot(null); onUnavailable("expired"); });
  async function submit(input?: CommandInput) {
    if (busy || conflict || !data || !lead.capabilities.canWrite || (!input && !attempt.current)) return;
    const command = prepareVersionedOperation(attempt.current, input ?? attempt.current!, lead.version) as LeadCommand;
    attempt.current = command; const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 15_000); setBusy(true); setError("");
    try {
      const snapshot = await requestLeadSnapshot(S05_ROUTES.commands(tenantId, lead.id), { method: "POST", csrf: data.csrfToken, body: command, signal: controller.signal });
      if (!alive.current) return;
      attempt.current = null; setUnknown(false); setConflict(false);
      if (!snapshot) { onUnavailable("expired"); return; }
      onChanged(snapshot);
    } catch (error) {
      if (!alive.current) return;
      if (leadDenied(error)) { attempt.current = null; onUnavailable(); return; }
      const failure = versionedFailure(error instanceof ApiError ? error.status : undefined, error instanceof ApiError ? error.code : undefined, unknown);
      setUnknown(failure.unknown);
      if (!failure.retain) attempt.current = null;
      setConflict(error instanceof ApiError && error.status === 409);
      setError(failure.unknown ? "Chưa xác định thao tác đã được lưu hay chưa. Nội dung được giữ lại. Thử lại cùng thao tác để kiểm tra kết quả; hệ thống không tạo thao tác thứ hai." : leadError(error));
    } finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  }
  async function compare() {
    if (busy) return; setBusy(true); setLatestSnapshot(null);
    const controller = new AbortController(); pending.current = controller;
    try { const snapshot = await requestLeadSnapshot(S05_ROUTES.lead(tenantId, lead.id), { signal: controller.signal }); if (alive.current) { if (!snapshot) { onUnavailable("expired"); return; } setLatestSnapshot(snapshot); } }
    catch (error) { if (alive.current) { setError(leadError(error)); if (leadDenied(error)) onUnavailable(); } }
    finally { if (alive.current) setBusy(false); }
  }
  function applyLatest() { if (!alive.current) return; if (!leadFromSnapshot(latestSnapshot)) { setLatestSnapshot(null); onUnavailable("expired"); return; } onChanged(latestSnapshot!); }
  return { busy, error, unknown, conflict, latest, submit, compare, applyLatest };
}
