import { RESERVED_SLUGS, S03_LIMITS, type ServiceContent } from "../../api/src/contracts/s03";
import { visibleText } from "./rich-text";
export function suggestedSlug(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("đ", "d").replaceAll("Đ", "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63).replace(/-$/, "");
}
export function validSlug(value: string) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 63 && !(RESERVED_SLUGS as readonly string[]).includes(value); }
export function serviceValidation(content: ServiceContent) {
  if (!content.title.trim() || content.title.length > S03_LIMITS.title) return "Nhập tên dịch vụ, tối đa 160 ký tự.";
  if (!validSlug(content.slug)) return "Đường dẫn cần 1–63 ký tự chữ thường không dấu, chữ số hoặc dấu gạch nối; không dùng tên dành riêng.";
  if (content.summary.length > S03_LIMITS.summary || content.seo.title.length > S03_LIMITS.seoTitle || content.seo.description.length > S03_LIMITS.seoDescription) return "Giới thiệu ngắn hoặc thông tin SEO vượt giới hạn cho phép.";
  if (visibleText(content.body).length > S03_LIMITS.bodyText) return "Nội dung tối đa 20.000 ký tự hiển thị.";
  if ([content.title, content.summary, content.seo.title, content.seo.description].some(value => value.includes("\0"))) return "Nội dung chứa ký tự không hợp lệ.";
  return "";
}
