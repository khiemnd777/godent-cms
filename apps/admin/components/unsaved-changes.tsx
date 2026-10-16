"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function requestGuardedAction(action: () => void) {
  if (window.dispatchEvent(new CustomEvent("godent:before-action", { cancelable: true, detail: { action } }))) action();
}
export function UnsavedChanges({ dirty, description = "Thay đổi trong bản nháp này chưa được lưu.", continueLabel = "Tiếp tục soạn" }: { dirty: boolean; description?: string; continueLabel?: string }) {
  const router = useRouter(); const dialog = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const open = (event: Event, target: string) => { event.preventDefault(); event.stopImmediatePropagation(); returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setDestination(target); };
    const link = (event: MouseEvent) => { const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null; if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.origin !== location.origin || anchor.pathname === location.pathname && anchor.search === location.search) return; open(event, anchor.pathname + anchor.search + anchor.hash); };
    const tenant = (event: Event) => { if (event instanceof CustomEvent && typeof event.detail?.href === "string") open(event, event.detail.href); };
    const internal = (event: Event) => { if (event instanceof CustomEvent && typeof event.detail?.action === "function") { pendingAction.current = event.detail.action; open(event, "internal-action"); } };
    window.addEventListener("beforeunload", leave); document.addEventListener("click", link, true); window.addEventListener("godent:before-navigation", tenant); window.addEventListener("godent:before-action", internal);
    return () => { window.removeEventListener("beforeunload", leave); document.removeEventListener("click", link, true); window.removeEventListener("godent:before-navigation", tenant); window.removeEventListener("godent:before-action", internal); };
  }, [dirty]);
  useEffect(() => { if (destination) dialog.current?.showModal(); else dialog.current?.close(); }, [destination]);
  const close = () => { setDestination(null); pendingAction.current = null; returnFocus.current?.focus(); };
  return <dialog ref={dialog} className="service-dialog" aria-labelledby="leave-title" onCancel={event => { event.preventDefault(); close(); }}><div className="dialog-body form-stack"><h2 id="leave-title">Rời trang khi chưa lưu?</h2><p>{description}</p><div className="buttons"><button type="button" className="btn primary" onClick={close}>{continueLabel}</button><button type="button" className="btn" onClick={() => { const href = destination; const action = pendingAction.current; close(); if (action) action(); else if (href) router.push(href); }}>Bỏ thay đổi và rời trang</button></div></div></dialog>;
}
