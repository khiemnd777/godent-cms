import type { M4PrivateMedia } from "../../api/src/contracts/m4";
export function privateGalleryPairs(media: M4PrivateMedia[]) {
  return [...new Set(media.flatMap(item => item.pairIndex === undefined ? [] : [item.pairIndex]))].sort((a, b) => a - b).flatMap(index => {
    const before = media.filter(item => item.pairIndex === index && item.slot === "before"), after = media.filter(item => item.pairIndex === index && item.slot === "after");
    return before.length === 1 && after.length === 1 && before[0].assetId !== after[0].assetId ? [{ index, before: before[0], after: after[0] }] : [];
  });
}
export function previewIssueText(issue: string) {
  if (issue === "RESOURCE_UNAVAILABLE") return "Nội dung không còn khả dụng.";
  if (issue === "REFERENCE_UNAVAILABLE") return "Một nội dung liên kết không còn đủ điều kiện hoặc chưa có bản xuất bản cùng ngôn ngữ.";
  if (issue === "TEXT_PERMISSION_REQUIRED") return "Chưa có quyền công bố nội dung chữ cho đúng bản và ngôn ngữ này.";
  if (issue === "MEDIA_PERMISSION_OR_READINESS") return "Một ảnh chưa sẵn sàng hoặc chưa có quyền đúng phạm vi cho bản này.";
  if (issue === "CONFIG_UNAVAILABLE") return "Cấu hình cùng ngôn ngữ chưa sẵn sàng.";
  return "Một điều kiện xem trước hoặc xuất bản chưa đáp ứng. Kiểm tra nội dung, liên kết và quyền công bố.";
}
