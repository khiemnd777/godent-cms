"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, errorText } from "../lib/access";

export function usePrivateRecord<T>(path: string) {
  const [value, setValue] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [observedAt, setObservedAt] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; setLoading(true); setError("");
    try { const next = await apiRequest<T>(path, { signal: controller.signal }); if (!controller.signal.aborted) { setValue(next); setObservedAt(Date.now()); } }
    catch (error) { if (!controller.signal.aborted) { setValue(null); setError(errorText(error)); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [path]);
  useEffect(() => { const refresh = () => { if (document.visibilityState === "visible") void reload(); }; void Promise.resolve().then(reload); window.addEventListener("focus", refresh); window.addEventListener("godent:access-changed", refresh); document.addEventListener("visibilitychange", refresh); return () => { pending.current?.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("godent:access-changed", refresh); document.removeEventListener("visibilitychange", refresh); }; }, [reload]);
  return { value, setValue, error, loading, reload, observedAt };
}
