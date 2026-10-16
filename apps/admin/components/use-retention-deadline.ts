"use client";
import { useEffect, useRef } from "react";

export function useRetentionDeadline(deadline: number, onExpire: () => void) {
  const callback = useRef(onExpire);
  useEffect(() => { callback.current = onExpire; }, [onExpire]);
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    let timer: ReturnType<typeof setTimeout>; let expired = false;
    const check = () => {
      clearTimeout(timer);
      const remaining = deadline - Date.now();
      if (remaining <= 0) { if (!expired) { expired = true; callback.current(); } }
      else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    check(); window.addEventListener("focus", check); document.addEventListener("visibilitychange", check);
    return () => { clearTimeout(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [deadline]);
}
