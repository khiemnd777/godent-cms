import type { ClosureReason, ContactOutcome, LeadHistoryEvent, LeadStatus } from "../../api/src/contracts/s05";
import { ApiError, errorText } from "./access";

export const leadStatus: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "Mới", color: "blue" }, assigned: { label: "Đã phân công", color: "amber" },
  contacted: { label: "Đã liên hệ", color: "green" }, closed: { label: "Đã đóng", color: "gray" },
};
export const closureReason: Record<ClosureReason, string> = { completed: "Đã hoàn tất", unreachable: "Không liên hệ được", spam: "Spam", duplicate: "Trùng yêu cầu" };
export const contactOutcome: Record<ContactOutcome, string> = { two_way: "Đã trao đổi hai chiều", unanswered: "Đã gọi, chưa gặp", email_sent: "Đã gửi email" };
export const leadDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
export const leadDenied = (error: unknown) => error instanceof ApiError && [401, 403, 404].includes(error.status) && error.code !== "REAUTH_REQUIRED";
export function leadError(error: unknown): string {
  if (!(error instanceof ApiError)) return errorText(error);
  if (error.code === "ASSIGNEE_UNAVAILABLE") return "Người phụ trách không còn đủ điều kiện. Lựa chọn của bạn được giữ lại. Tải dữ liệu hiện tại để kiểm tra.";
  if (error.code === "VERSION_CONFLICT") return "Yêu cầu đã được cập nhật. Thông tin bạn đang soạn được giữ lại. Đối chiếu bản hiện tại trước khi lưu lại.";
  if (error.code === "OPERATION_CONFLICT") return "Mã thao tác đã được dùng cho nội dung khác. Kiểm tra bản hiện tại trước khi thử lại.";
  if (error.code === "INVALID_TRANSITION") return "Yêu cầu chưa đáp ứng điều kiện chuyển trạng thái. Kiểm tra lịch sử liên hệ và trạng thái hiện tại.";
  if (error.code === "INVALID_INPUT") return "Thông tin chưa hợp lệ. Kiểm tra các trường rồi thử lại.";
  return errorText(error);
}
export function historySummary(event: LeadHistoryEvent): string {
  switch (event.kind) {
    case "assign": return event.payload.after ? `Phân công cho ${event.payload.after.name}` : "Bỏ phân công";
    case "note": return "Ghi chú nội bộ";
    case "contact": return `${event.payload.channel === "phone" ? "Điện thoại" : "Email"} · ${contactOutcome[event.payload.outcome]}`;
    case "close": return `Đóng yêu cầu · ${closureReason[event.payload.reason]}`;
    case "reopen": return `Mở lại · ${leadStatus[event.payload.status].label}`;
  }
}
