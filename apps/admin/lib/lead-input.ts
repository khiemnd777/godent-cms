import { S05_LIMITS, type LeadQuery, type LeadStatus } from "../../api/src/contracts/s05";
export type LeadFilters = { q: string; status: LeadStatus | ""; assignee: string; from: string; to: string; pageSize: number };
export const emptyLeadFilters: LeadFilters = { q: "", status: "", assignee: "", from: "", to: "", pageSize: 20 };
export function leadText(value: string, max = S05_LIMITS.text) {
  const text = value.normalize("NFC").trim();
  if (!text || [...text].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(text)) throw new Error(`Nhập nội dung từ 1 đến ${max.toLocaleString("vi-VN")} ký tự hợp lệ.`);
  return text;
}
export function leadQuery(fields: LeadFilters): LeadQuery {
  const q = fields.q.normalize("NFC").trim();
  if (q && ([...q].length < S05_LIMITS.searchMin || [...q].length > S05_LIMITS.searchMax)) throw new Error("Tìm theo tên hoặc mã yêu cầu từ 2 đến 80 ký tự.");
  for (const day of [fields.from, fields.to]) if (day && (!/^\d{4}-\d\d-\d\d$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day)) throw new Error("Kiểm tra ngày tiếp nhận.");
  if (fields.from && fields.to && fields.from > fields.to) throw new Error("Ngày bắt đầu phải trước hoặc cùng ngày kết thúc.");
  if (![20, 50].includes(fields.pageSize)) throw new Error("Chọn 20 hoặc 50 yêu cầu trên trang.");
  return { ...(q ? { q } : {}), ...(fields.status ? { status: fields.status } : {}), ...(fields.assignee ? { assignee: fields.assignee } : {}), ...(fields.from ? { from: fields.from } : {}), ...(fields.to ? { to: fields.to } : {}), pageSize: fields.pageSize };
}
export function queryParameters(query: LeadQuery, cursor?: string | null, count = false) {
  const params = new URLSearchParams();
  for (const key of ["q", "status", "assignee", "from", "to"] as const) if (query[key]) params.set(key, query[key]!);
  if (!count) { params.set("pageSize", String(query.pageSize)); if (cursor) params.set("cursor", cursor); }
  return params.toString();
}
export function countLabel(value: number, capped: boolean) { return `${value.toLocaleString("vi-VN")}${capped ? "+" : ""}`; }
