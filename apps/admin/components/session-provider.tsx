"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest, type CurrentSession, ApiError } from "../lib/access";
import { ShellState } from "./shell-state";

type Status = "loading" | "authenticated" | "anonymous" | "expired" | "error";
type SessionContext = { data: CurrentSession | null; status: Status; refresh: () => Promise<CurrentSession | null>; clear: () => void; logout: () => Promise<void> };
const Context = createContext<SessionContext | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CurrentSession | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const generation = useRef(0);
  const clear = useCallback(() => { generation.current++; setData(null); setStatus("anonymous"); }, []);
  const expire = useCallback(() => { generation.current++; setData(null); setStatus("expired"); }, []);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    try {
      const next = await apiRequest<CurrentSession>("/api/session", { sessionCheck: true });
      if (version !== generation.current) return null;
      if (!Number.isFinite(Date.parse(next.session.expiresAt)) || Date.parse(next.session.expiresAt) <= Date.now()) { expire(); return null; }
      setData(next); setStatus("authenticated"); return next;
    } catch (error) {
      if (version === generation.current) { setData(null); setStatus(error instanceof ApiError && error.status === 401 ? "anonymous" : "error"); }
      return null;
    }
  }, [expire]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const check = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("godent:session-expired", expire);
    window.addEventListener("focus", check);
    window.addEventListener("godent:access-changed", check);
    document.addEventListener("visibilitychange", check);
    // No polling extends the absolute session lifetime. A fresh server check catches revocation.
    const interval = window.setInterval(check, 60_000);
    const channel = new BroadcastChannel("godent-session");
    channel.onmessage = event => { if (event.data === "ended") expire(); };
    return () => { clearInterval(interval); channel.close(); window.removeEventListener("godent:session-expired", expire); window.removeEventListener("godent:access-changed", check); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [refresh, expire]);
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(expire, Math.max(0, Date.parse(data.session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [data, expire]);
  const logout = async () => { await apiRequest("/api/auth/sign-out", { method: "POST", body: {} }); const channel = new BroadcastChannel("godent-session"); channel.postMessage("ended"); channel.close(); clear(); window.location.replace("/login"); };
  return <Context.Provider value={{ data, status, refresh, clear, logout }}>{children}</Context.Provider>;
}
export function useSession() { const context = useContext(Context); if (!context) throw new Error("Missing session provider"); return context; }
export function SessionGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session.status === "loading") return <div className="standalone"><ShellState kind="loading" title="Đang kiểm tra phiên đăng nhập" description="Vui lòng chờ trong giây lát."/></div>;
  if (!session.data) return <div className="standalone"><ShellState kind={session.status === "error" ? "error" : "denied"} title={session.status === "expired" ? "Phiên đăng nhập đã kết thúc" : session.status === "error" ? "Chưa thể kiểm tra phiên" : "Đăng nhập để tiếp tục"} description="Nội dung riêng chỉ hiển thị khi phiên đăng nhập còn hiệu lực."><Link className="btn primary" href="/login" prefetch={false}>Đăng nhập</Link>{session.status === "error" && <button className="btn" onClick={() => void session.refresh()}>Thử lại</button>}</ShellState></div>;
  return <>{children}</>;
}
