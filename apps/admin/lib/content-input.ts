import { M3_LIMITS, M3_REFERENCE_RULES, type ContentKind, type DentalContent } from "../../api/src/contracts/m3";
import { safeLink, sourceDocument } from "./rich-text";
import { serviceValidation } from "./service-input";
import { decimalPriceError } from "./decimal-price";

export function emptyContent(kind: ContentKind): DentalContent {
  const base = { slug: "", title: "", summary: "", body: sourceDocument(""), seo: { title: "", description: "" }, references: [] };
  switch (kind) {
    case "location": return { ...base, kind, address: "", phone: "", email: "", mapUrl: "", openingHours: Array.from({ length: 7 }, (_, day) => ({ day, closed: true, intervals: [] })) };
    case "doctor": return { ...base, kind, professionalTitle: "", credentials: [], languages: [], image: null };
    case "price": return { ...base, kind, price: { type: "exact", amount: "", currency: "VND", unit: "" }, inclusions: "", notes: "" };
    case "gallery": return { ...base, kind, pairs: [] };
    case "testimonial": return { ...base, kind, quote: "", displayName: "", attribution: "", image: null };
    case "article": return { ...base, kind, attribution: "", image: null };
    case "case": return { ...base, kind, image: null };
    default: return { ...base, kind };
  }
}
export function contentInputError(content: DentalContent) {
  const common = serviceValidation(content); if (common) return common.replaceAll("dịch vụ", "nội dung");
  if (content.references.length > M3_LIMITS.references || new Set(content.references.map(ref => `${ref.kind}:${ref.id}`)).size !== content.references.length) return "Danh sách liên kết bị trùng hoặc vượt giới hạn 50 nội dung.";
  if (content.references.some(ref => !M3_REFERENCE_RULES[content.kind].includes(ref.kind))) return "Loại nội dung liên kết không phù hợp. Kiểm tra danh sách liên kết.";
  if ("image" in content && content.image && (!content.image.assetId || !content.image.alt.trim())) return "Chọn ảnh hợp lệ và nhập mô tả ảnh.";
  if (content.kind === "price") {
    const p = content.price; const value = p.type === "range" ? p.minimum : p.amount;
    const error = decimalPriceError(p.type, value, p.type === "range" ? p.maximum : "", p.currency, p.unit); if (error) return error;
    const valid = new RegExp(`^(?:0|[1-9]\\d{0,${M3_LIMITS.decimalIntegerDigits - 1}})(?:\\.\\d{1,${M3_LIMITS.decimalScale}})?$`);
    if (!valid.test(value) || p.type === "range" && !valid.test(p.maximum)) return "Số tiền tối đa 24 chữ số nguyên và 6 chữ số thập phân.";
    if (content.references.filter(ref => ref.kind === "service").length !== 1) return "Chọn đúng một dịch vụ áp dụng cho giá.";
  }
  if (content.kind === "location") {
    if (!content.address.trim()) return "Nhập địa chỉ cơ sở.";
    if (content.phone && !/^\+?[0-9 ().-]+$/.test(content.phone)) return "Kiểm tra số điện thoại của cơ sở.";
    if (content.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)) return "Kiểm tra địa chỉ email của cơ sở.";
    if (content.mapUrl && !safeLink(content.mapUrl)) return "Liên kết bản đồ cần là URL HTTP/HTTPS hợp lệ, không chứa tài khoản.";
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (content.openingHours.some(day => day.closed ? day.intervals.length > 0 : !day.intervals.length || day.intervals.length > 4 || day.intervals.some((interval, index) => !time.test(interval.opens) || !time.test(interval.closes) || interval.opens >= interval.closes || index > 0 && interval.opens < day.intervals[index - 1].closes))) return "Mỗi ngày mở cửa cần từ 1 đến 4 khoảng giờ theo thứ tự, không chồng nhau. Ngày nghỉ không có khoảng giờ.";
  }
  if (content.kind === "doctor" && [...content.credentials, ...content.languages].some(value => !value.trim())) return "Nhập thông tin vào từng dòng bằng cấp và ngôn ngữ, hoặc bỏ dòng trống.";
  if (content.kind === "testimonial" && (!content.quote.trim() || !content.displayName.trim())) return "Nhập nội dung đánh giá và tên được phép hiển thị.";
  if (content.kind === "gallery") {
    if (!content.pairs.length || content.pairs.length > M3_LIMITS.pairs) return "Gallery cần từ 1 đến 20 cặp ảnh trước và sau.";
    const images = content.pairs.flatMap(pair => [pair.before, pair.after]);
    if (images.some(image => !image.assetId || !image.alt.trim())) return "Mỗi cặp cần đủ ảnh trước, ảnh sau và mô tả cho cả hai ảnh.";
    if (new Set(images.map(image => image.assetId)).size !== images.length) return "Mỗi ảnh chỉ được dùng một lần trong gallery.";
  }
  return "";
}
