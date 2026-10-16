"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, errorText, type Page } from "../lib/access";

export function usePrivatePage<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async (after: string | null = null) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError("");
    try {
      const page = await apiRequest<Page<T>>(`${path}${after ? `?cursor=${encodeURIComponent(after)}` : ""}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setItems(previous => after ? [...previous, ...page.items] : page.items); setCursor(page.nextCursor);
    } catch (error) {
      if (!controller.signal.aborted) { setItems([]); setCursor(null); setError(errorText(error)); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }, [path]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; pending.current?.abort(); }; }, [load]);
  return { items, cursor, busy, error, reload: () => load(), more: () => load(cursor) };
}
