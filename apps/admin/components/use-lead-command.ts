"use client";
import { useEffect, useRef, useState } from "react";
import { S05_ROUTES, type LeadCommand, type LeadCommandResult, type LeadDetail } from "../../api/src/contracts/s05";
import { ApiError, apiRequest } from "../lib/access";
import { leadDenied, leadError } from "../lib/lead-presentation";
import { prepareVersionedOperation, versionedFailure } from "../lib/versioned-operation";
import { useSession } from "./session-provider";

type CommandInput<T = LeadCommand> = T extends LeadCommand ? Omit<T, "operationId" | "expectedVersion"> : never;
export function useLeadCommand({ tenantId, lead, onChanged, onUnavailable }: {
  tenantId: string; lead: LeadDetail; onChanged: (lead: LeadDetail) => void; onUnavailable: () => void;
}) {
  const { data } = useSession();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [unknown, setUnknown] = useState(false); const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<LeadDetail | null>(null);
  const attempt = useRef<LeadCommand | null>(null); const pending = useRef<AbortController | null>(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort(); }; }, []);
  async function submit(input?: CommandInput) {
    if (busy || conflict || !data || !lead.capabilities.canWrite || (!input && !attempt.current)) return;
    const command = prepareVersionedOperation(attempt.current, input ?? attempt.current!, lead.version) as LeadCommand;
    attempt.current = command; const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 15_000); setBusy(true); setError("");
    try {
      const result = await apiRequest<LeadCommandResult>(S05_ROUTES.commands(tenantId, lead.id), { method: "POST", csrf: data.csrfToken, body: command, signal: controller.signal });
      if (!alive.current) return;
      attempt.current = null; setUnknown(false); setConflict(false); onChanged(result.lead);
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
    if (busy) return; setBusy(true);
    try { const current = await apiRequest<LeadDetail>(S05_ROUTES.lead(tenantId, lead.id)); if (alive.current) setLatest(current); }
    catch (error) { if (alive.current) { setError(leadError(error)); if (leadDenied(error)) onUnavailable(); } }
    finally { if (alive.current) setBusy(false); }
  }
  return { busy, error, unknown, conflict, latest, submit, compare };
}
