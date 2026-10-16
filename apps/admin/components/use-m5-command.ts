"use client";
import { useEffect, useRef, useState } from "react";
import { versionedFailure } from "../lib/versioned-operation";
import { ApiError, apiRequest, errorText } from "../lib/access";
import { useSession } from "./session-provider";

export function useM5Command<T>(applied: (result: T) => void | Promise<void>) {
  const { data } = useSession();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [unknown, setUnknown] = useState(false), [reauth, setReauth] = useState(false), [conflict, setConflict] = useState(false);
  const pending = useRef<{ path: string; body: object } | null>(null), request = useRef<AbortController | null>(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  async function submit(path: string, body: object) {
    if (!data || busy || conflict) return;
    const command = pending.current ?? { path, body }; pending.current = command;
    const controller = new AbortController(); request.current = controller; const timer = setTimeout(() => controller.abort(), 15000); setBusy(true); setError("");
    try { const result = await apiRequest<T>(command.path, { method: "POST", body: command.body, csrf: data.csrfToken, signal: controller.signal }); if (!alive.current) return; pending.current = null; setUnknown(false); setReauth(false); await applied(result); }
    catch (error) {
      if (!alive.current) return;
      const uncertain = versionedFailure(error instanceof ApiError ? error.status : undefined, error instanceof ApiError ? error.code : undefined, unknown).unknown;
      setUnknown(uncertain); if (!uncertain) pending.current = null;
      setReauth(error instanceof ApiError && error.code === "REAUTH_REQUIRED"); setConflict(error instanceof ApiError && error.status === 409);
      setError(uncertain ? "Chưa xác định kết quả. Giữ nguyên thông tin và thử lại cùng thao tác." : errorText(error));
    } finally { clearTimeout(timer); if (alive.current) setBusy(false); }
  }
  return { busy, error, unknown, reauth, conflict, locked: busy || unknown || conflict || reauth, submit, retry: () => pending.current && submit(pending.current.path, pending.current.body), authenticated: () => { setReauth(false); setError(""); }, compared: () => { pending.current = null; setConflict(false); setError(""); } };
}
