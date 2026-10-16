import type { LeadSource } from "../../api/src/contracts/s04";
export const leadSourceTitle = (source: LeadSource) => source.type === "landing" ? source.title : source.serviceTitle;
export const leadSourceKind = (source: LeadSource) => source.type === "landing" ? "Landing" : "Dịch vụ";
