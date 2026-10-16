// Matches the bounded S02 HTTP input contract. Storage may permit larger values.
export const DRAFT_LIMITS = { title: 160, body: 20_000 } as const;
export function draftValidation(title: string, body: string) {
  if (!title.trim()) return "Nhập tên dịch vụ trước khi lưu.";
  if (title.length > DRAFT_LIMITS.title) return `Tên dịch vụ tối đa ${DRAFT_LIMITS.title} ký tự.`;
  if (body.length > DRAFT_LIMITS.body) return `Nội dung tối đa ${DRAFT_LIMITS.body.toLocaleString("vi-VN")} ký tự.`;
  if (title.includes("\0") || body.includes("\0")) return "Nội dung chứa ký tự không hợp lệ. Kiểm tra và thử lại.";
  return "";
}
