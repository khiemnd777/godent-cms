import type { LeadSource } from "../../api/src/contracts/s04";
export const leadSourceTitle = (source: LeadSource) => "serviceTitle" in source ? source.serviceTitle : source.title;
export const leadSourceKind = (source: LeadSource) => source.type === "landing" ? "Landing" : source.type === "home" ? "Trang chủ" : source.type === "page" ? "Trang nội dung" : "Dịch vụ";
