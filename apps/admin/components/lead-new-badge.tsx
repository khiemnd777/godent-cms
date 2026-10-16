"use client";
import { useEffect, useState } from "react";
import { S05_ROUTES, type LeadCount } from "../../api/src/contracts/s05";
import { apiRequest } from "../lib/access";
import { countLabel } from "../lib/lead-input";
export function LeadNewBadge({ tenantId }: { tenantId: string }) {
  const [count, setCount] = useState<LeadCount | null>(null);
  useEffect(() => {
    let active = true; let pending: AbortController | null = null;
    const load = async () => { pending?.abort(); const controller = new AbortController(); pending = controller; setCount(null); try { const next = await apiRequest<LeadCount>(S05_ROUTES.count(tenantId), { signal: controller.signal }); if (active && !controller.signal.aborted) setCount(next); } catch { if (active && !controller.signal.aborted) setCount(null); } };
    void Promise.resolve().then(load); window.addEventListener("godent:leads-updated", load);
    return () => { active = false; pending?.abort(); window.removeEventListener("godent:leads-updated", load); };
  }, [tenantId]);
  return count && count.newCount > 0 ? <span className="nav-count" aria-label={`${countLabel(count.newCount, count.newCapped)} yêu cầu mới trong nha khoa`}>{countLabel(count.newCount, count.newCapped)}</span> : null;
}
