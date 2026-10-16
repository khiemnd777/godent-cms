"use client";
import { useEffect, useRef, useState } from "react";
import { Heading2, List, Type, Link as LinkIcon } from "lucide-react";
import { safeLink, sourceDocument, visibleText } from "../lib/rich-text";
export function ServiceBodyInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const linkDialog = useRef<HTMLDialogElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [linkOpen, setLinkOpen] = useState(false); const [linkText, setLinkText] = useState(""); const [linkUrl, setLinkUrl] = useState(""); const [error, setError] = useState("");
  useEffect(() => { if (linkOpen) linkDialog.current?.showModal(); else linkDialog.current?.close(); }, [linkOpen]);
  function addLink() { if (!linkText.trim() || !safeLink(linkUrl)) { setError("Nhập nội dung và địa chỉ liên kết HTTP/HTTPS hợp lệ."); return; } const { start, end } = selection.current; const replacement = `[${linkText.replace(/[\\[\]]/g, "\\$&")}](${linkUrl.replaceAll("(", "%28").replaceAll(")", "%29")})`; onChange(value.slice(0, start) + replacement + value.slice(end)); setLinkOpen(false); input.current?.focus(); }
  let count: number | null = null;
  try { const text = visibleText(sourceDocument(value)).trim(); count = text ? text.split(/\s+/).length : 0; } catch { /* Invalid authoring input remains visible and cannot be saved. */ }
  function insert(kind: "heading" | "list" | "text" | "link") {
    const target = input.current; if (!target) return;
    const start = target.selectionStart; const end = target.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    if (kind === "link") { selection.current = { start, end }; setLinkText(value.slice(start, end)); setLinkUrl(""); setError(""); setLinkOpen(true); return; }
    const line = value.slice(lineStart).replace(/^(## |- )/, ""); const prefix = kind === "heading" ? "## " : kind === "list" ? "- " : ""; const next = value.slice(0, lineStart) + prefix + line; const caret = start + prefix.length;
    onChange(next); requestAnimationFrame(() => { target.focus(); target.setSelectionRange(caret, caret); });
  }
  return <div className="field service-body-field"><label htmlFor="service-body">Nội dung chi tiết</label><div className="text-editor"><div className="text-tools" role="toolbar" aria-label="Định dạng nội dung"><button type="button" disabled={disabled} onClick={() => insert("heading")} aria-label="Định dạng tiêu đề H2"><Heading2 size={15}/></button><button type="button" disabled={disabled} onClick={() => insert("list")} aria-label="Định dạng danh sách"><List size={15}/></button><button type="button" disabled={disabled} onClick={() => insert("text")}><Type size={14}/>Văn bản</button><button type="button" disabled={disabled} onClick={() => insert("link")} aria-label="Chèn liên kết"><LinkIcon size={15}/></button></div><textarea ref={input} id="service-body" name="body" disabled={disabled} rows={16} maxLength={100_000} value={value} onChange={event => onChange(event.target.value)} aria-describedby="body-help"/><div className="editor-status"><span>{count === null ? "Kiểm tra nội dung" : `${count} từ`}</span><span>VI · Tiếng Việt</span></div></div><p id="body-help" className="field-help">Dùng H2, danh sách và liên kết HTTP/HTTPS. Nội dung HTML được hiển thị như văn bản. Tối đa 20.000 ký tự hiển thị.</p><dialog ref={linkDialog} className="service-dialog" aria-labelledby="link-title" onCancel={event => { event.preventDefault(); setLinkOpen(false); input.current?.focus(); }}><div className="dialog-body form-stack" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }}><h2 id="link-title">Chèn liên kết</h2><label className="field">Nội dung liên kết<input value={linkText} onChange={event => setLinkText(event.target.value)} maxLength={500}/></label><label className="field">Địa chỉ liên kết<input type="url" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} maxLength={2048} autoCapitalize="none"/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="buttons"><button type="button" className="btn" onClick={() => { setLinkOpen(false); input.current?.focus(); }}>Quay lại</button><button type="button" className="btn primary" onClick={addLink}>Chèn liên kết</button></div></div></dialog></div>;
}
