"use client";
import { useEffect, useState } from "react";
import { S05_ROUTES, type LeadCount } from "../../api/src/contracts/s05";
import { deadlineFromResponse, isCurrentResponse } from "../lib/retention-input";
import { apiRequest } from "../lib/access";
import { countLabel } from "../lib/lead-input";
export function LeadNewBadge({ tenantId }: { tenantId: string }) {
  const [count, setCount] = useState<LeadCount | null>(null);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout>; let pending: AbortController | null = null;
    const load = async () => { pending?.abort(); const controller = new AbortController(); pending = controller; setCount(null); clearTimeout(timer); const started = Date.now(); try { const next = await apiRequest<LeadCount>(S05_ROUTES.count(tenantId), { signal: controller.signal }); if (active && !controller.signal.aborted) { const deadline = deadlineFromResponse(next.serverTime, next.validUntil, started); if (isCurrentResponse(deadline)) { setCount(next); if (Number.isFinite(deadline)) timer = setTimeout(() => { setCount(null); void load(); }, Math.min(deadline - Date.now(), 2_147_483_647)); } } } catch { if (active && !controller.signal.aborted) setCount(null); } };
    void Promise.resolve().then(load); window.addEventListener("godent:leads-updated", load);
    return () => { active = false; pending?.abort(); clearTimeout(timer); window.removeEventListener("godent:leads-updated", load); };
  }, [tenantId]);
  return count && count.newCount > 0 ? <span className="nav-count" aria-label={`${countLabel(count.newCount, count.newCapped)} yêu cầu mới trong nha khoa`}>{countLabel(count.newCount, count.newCapped)}</span> : null;
}
