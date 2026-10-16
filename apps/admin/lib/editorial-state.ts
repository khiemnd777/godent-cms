import type { PublicationService } from "../../api/src/contracts/s03";
import { MEDIA_LIMITS } from "../../api/src/contracts/s07";
import { apiUrl } from "./access";
export function editorialState(service: Pick<PublicationService, "activePublication" | "publicationVersion" | "draftVersion" | "publishedDraftVersion" | "publishedSiteVersion"> | null, siteVersion: number | undefined, dirty: boolean) {
  const active = service?.activePublication === true;
  return { active, pending: !active || service.publishedDraftVersion !== service.draftVersion || service.publishedSiteVersion !== siteVersion || dirty, liveVersion: active ? service.publicationVersion : null, lastPublishedVersion: service?.publicationVersion ?? 0 };
}
export function mediaUploadError(file: { size: number; type: string }) {
  if (file.size < 1 || file.size > MEDIA_LIMITS.bytes) return "Chọn ảnh có dung lượng từ 1 byte đến 5 MiB.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Chỉ nhận JPEG, PNG hoặc WebP. Máy chủ sẽ kiểm tra toàn bộ nội dung ảnh.";
  return "";
}
export function safeMediaAccess(value: string) {
  const url = new URL(value, apiUrl("/api/"));
  return apiUrl(url.origin === new URL(apiUrl("/api/")).origin ? url.pathname + url.search : "invalid");
}
