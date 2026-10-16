"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronRight, ChevronDown, Smile, ArrowRight, LogOut, UserRound } from "lucide-react";
import { useSession } from "./session-provider";
import { useWorkspace } from "./workspace";
import { errorText, tenantHref } from "../lib/access";
import { useRouter } from "next/navigation";
import { PublishedServiceLink } from "./published-service-link";
import { LeadNewBadge } from "./lead-new-badge";
import { cmsNavigation, platformNavigation, findActiveNavigation, type NavItem } from "./navigation";
export function AdminShell({ children, area = "cms" }: { children: React.ReactNode; area?: "cms" | "platform" }) {
 const pathname = usePathname();
 const router = useRouter();
 const session = useSession();
 const { membership, href } = useWorkspace();
 const [logoutError, setLogoutError] = useState("");
 const [loggingOut, setLoggingOut] = useState(false);
 const signOut = async () => { setLoggingOut(true); setLogoutError(""); try { await session.logout(); } catch (error) { setLogoutError(errorText(error)); setLoggingOut(false); } };
 const platform = area === "platform";
 const navigation = platform ? platformNavigation : cmsNavigation;
 const [open, setOpen] = useState(false);
 const [mobile, setMobile] = useState(false);
 const navRef = useRef<HTMLElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 const closeRef = useRef<HTMLButtonElement>(null);
 const activeItem = findActiveNavigation(navigation, pathname);
 const title = activeItem?.label ?? "Trang không tồn tại";
 useEffect(() => { const query = window.matchMedia("(max-width: 1023px)"); const update = () => { setMobile(query.matches); if (!query.matches) setOpen(false); }; update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
 useEffect(() => { if (!open) return; const focusFrame = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true })); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); } if (event.key === "Tab") { const targets = navRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), summary'); const visible = Array.from(targets ?? []).filter(node => node.getClientRects().length > 0); const first = visible[0]; const last = visible.at(-1); if (!navRef.current?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", keydown); return () => { cancelAnimationFrame(focusFrame); document.body.style.overflow = previous; document.removeEventListener("keydown", keydown); }; }, [open]);
 const close = () => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
 const navLink = (item: NavItem) => <Link key={item.path} href={platform ? item.path : href(item.path)} prefetch={false} className={`nav-item ${activeItem?.path === item.path ? "active" : ""}`} aria-current={pathname === item.path ? "page" : activeItem?.path === item.path ? "location" : undefined} onClick={() => { if (mobile) close(); }}><item.icon size={17} aria-hidden="true" />{item.label}{item.path === "/cms/leads" && membership && <LeadNewBadge key={membership.tenantId} tenantId={membership.tenantId}/>}</Link>;
 return <><a className="skip" href="#main-content">Đến nội dung chính</a><aside ref={navRef} id="sidebar" className={`sidebar ${open ? "is-open" : ""}`} aria-label={platform ? "Điều hướng nền tảng" : "Điều hướng CMS"} inert={mobile && !open} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined}>
 <div className="logo" aria-label="Godent"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span>godent<span className="dot">.</span></div><div className="space-label">{platform ? "PLATFORM ADMIN" : "WORKSPACE"}</div>
 <button ref={closeRef} className="icon-button menu-close" onClick={close} aria-label="Đóng menu"><X size={20}/></button>
 {!platform && <div className="clinic-switch"><span className="clinic-symbol"><Smile size={18} aria-hidden="true"/></span><div><label className="small" htmlFor="tenant-switch">Nha khoa</label><select id="tenant-switch" className="clinic-select" aria-label="Chọn nha khoa cho tab này" value={membership?.tenantId ?? ""} onChange={event => { if (window.dispatchEvent(new CustomEvent("godent:before-navigation", { cancelable: true, detail: { href: tenantHref("/cms", event.target.value) } }))) { router.push(tenantHref("/cms", event.target.value)); if (mobile) close(); } }}><option value="">Chọn nha khoa</option>{session.data?.tenantMemberships.map(member => <option key={member.tenantId} value={member.tenantId}>{member.tenantName}</option>)}</select></div></div>}
 {platform && <div className="nav-section">QUẢN LÝ NỀN TẢNG</div>}
 <nav className="nav-list" aria-label={platform ? "Chức năng nền tảng" : "Chức năng website"}>{navigation.map((item, index) => <div key={item.path}>{!platform && index === 1 && <div className="nav-section">WEBSITE & NỘI DUNG</div>}{!platform && index === 7 && <div className="nav-section">CHĂM SÓC KHÁCH HÀNG</div>}{!platform && index === 8 && <div className="nav-section">THIẾT LẬP</div>}{item.children ? <details className="nav-group" open={item.children.some(child => child.path === activeItem?.path) || undefined}><summary><item.icon size={17} aria-hidden="true"/><span>{item.label}</span><ChevronDown className="nav-chevron" size={13} aria-hidden="true"/></summary><div className="subnav">{item.children.map(navLink)}</div></details> : navLink(item)}</div>)}</nav>
 <div className="sidebar-bottom"><div className="help-card"><strong>Một chút hỗ trợ?</strong><p>Hướng dẫn để quản lý website dễ dàng hơn.</p><button className="btn subtle" disabled title="Hướng dẫn chưa khả dụng">Xem hướng dẫn <ArrowRight size={13}/></button></div><div className="side-footer"><span>Godent</span><span>Tiếng Việt</span></div></div>
 </aside>{open && <div className="mobile-overlay" onClick={close} aria-hidden="true"/>}<div className="shell" inert={mobile && open}><header className="topbar"><div className="topbar-left"><button ref={trigger} className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Mở menu" aria-expanded={open} aria-controls="sidebar"><Menu size={20}/></button><div className="breadcrumbs"><span>{platform ? "Platform" : membership?.tenantName ?? "Website nha khoa"}</span><ChevronRight size={11} aria-hidden="true"/><strong>{title}</strong></div></div><div className="top-actions"><Link className="icon-button" href="/account" prefetch={false} aria-label="Tài khoản và bảo mật" title="Tài khoản và bảo mật"><UserRound size={18}/></Link><button className="icon-button" onClick={() => void signOut()} disabled={loggingOut} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={18}/></button>{platform ? <span className="platform-context">Nền tảng Godent</span> : <PublishedServiceLink key={`${membership?.tenantId ?? "none"}:${pathname}`} tenantId={membership?.tenantId ?? null}/>}</div></header><main id="main-content" className="main" tabIndex={-1}>{logoutError && <p className="form-error" role="alert">{logoutError}</p>}{children}<footer className="main-footer"><span>Được xây dựng cùng Godent</span><span>{platform ? "Không gian quản lý nền tảng" : "Website nha khoa · Nội dung của bạn, thương hiệu của bạn"}</span></footer></main></div></>;
}
