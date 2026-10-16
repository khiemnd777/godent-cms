"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { S05_ROUTES, type LeadAssigneeOption, type LeadAssigneePage } from "../../api/src/contracts/s05";
import { apiRequest } from "../lib/access";
import { leadDenied, leadError } from "../lib/lead-presentation";
export function useLeadAssignees(tenantId: string, onUnavailable: () => void) {
  const [page, setPage] = useState<LeadAssigneePage>({ items: [], nextCursor: null });
  const [known, setKnown] = useState<LeadAssigneeOption[]>([]);
  const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null); const appliedQuery = useRef("");
  const load = useCallback(async (cursor: string | null = null, q?: string) => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const search = q ?? appliedQuery.current; appliedQuery.current = search;
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ pageSize: "50" }); if (cursor) params.set("cursor", cursor); if (search) params.set("q", search);
      const next = await apiRequest<LeadAssigneePage>(`${S05_ROUTES.assignees(tenantId)}?${params}`, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setPage(previous => ({ items: cursor ? [...previous.items, ...next.items] : next.items, nextCursor: next.nextCursor }));
        setKnown(previous => [...new Map([...previous, ...next.items].map(item => [item.userId, item])).values()]);
      }
    } catch (error) { if (!controller.signal.aborted) { setPage({ items: [], nextCursor: null }); setKnown([]); setError(leadError(error)); if (leadDenied(error)) onUnavailable(); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [tenantId, onUnavailable]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; pending.current?.abort(); }; }, [load]);
  return { page, known, busy, error, load };
}
