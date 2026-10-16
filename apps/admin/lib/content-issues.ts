const issueText: Record<string, string> = {
  REFERENCE_UNAVAILABLE: "Một nội dung liên kết không còn đủ điều kiện công khai. Kiểm tra và chọn bản đã xuất bản hợp lệ trước khi cập nhật website.",
  TEXT_PERMISSION_REQUIRED: "Chưa có quyền công bố nội dung chữ cho đúng tài nguyên và bản nháp đã lưu này.",
  ASSET_PERMISSION_REQUIRED: "Một ảnh chưa có quyền công bố đúng tài nguyên, bản nháp và phiên bản ảnh, hoặc ảnh không còn đủ điều kiện sử dụng.",
  FAQ_ANSWER_REQUIRED: "Nhập câu trả lời cho FAQ trước khi xuất bản.",
  PUBLIC_GRAPH_LIMIT: "Nội dung liên kết vượt giới hạn công bố. Giảm số lượng hoặc mức lồng nội dung trước khi thử lại.",
};
export function contentIssueText(issue: string) { return issueText[issue] ?? "Nội dung chưa đáp ứng điều kiện công bố. Kiểm tra bản nháp, liên kết và quyền sử dụng trước khi thử lại."; }
