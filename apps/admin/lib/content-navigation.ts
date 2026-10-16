import type { ContentKind } from "../../api/src/contracts/m3";
export const contentSections = {
  specialty: { title: "Chuyên khoa", singular: "chuyên khoa", path: "/cms/services/specialties", publicPath: "chuyen-khoa", area: "Dịch vụ", family: "services" },
  service_group: { title: "Nhóm dịch vụ", singular: "nhóm dịch vụ", path: "/cms/services/groups", publicPath: "nhom-dich-vu", area: "Dịch vụ", family: "services" },
  location: { title: "Cơ sở", singular: "cơ sở", path: "/cms/locations", publicPath: "co-so", area: "Nội dung nha khoa", family: "dental" },
  doctor: { title: "Bác sĩ", singular: "hồ sơ bác sĩ", path: "/cms/doctors", publicPath: "bac-si", area: "Nội dung nha khoa", family: "dental" },
  price: { title: "Bảng giá", singular: "giá", path: "/cms/pricing", publicPath: "bang-gia", area: "Nội dung nha khoa", family: "dental" },
  case: { title: "Ca điều trị", singular: "ca điều trị", path: "/cms/cases", publicPath: "ca-dieu-tri", area: "Câu chuyện khách hàng", family: "stories" },
  gallery: { title: "Trước & sau", singular: "gallery trước và sau", path: "/cms/before-after", publicPath: "truoc-sau", area: "Câu chuyện khách hàng", family: "stories" },
  testimonial: { title: "Đánh giá", singular: "đánh giá", path: "/cms/reviews", publicPath: "danh-gia", area: "Câu chuyện khách hàng", family: "stories" },
  article: { title: "Bài viết", singular: "bài viết", path: "/cms/articles", publicPath: "bai-viet", area: "Bài viết & FAQ", family: "articles" },
  category: { title: "Chuyên mục", singular: "chuyên mục", path: "/cms/articles/categories", publicPath: "chuyen-muc", area: "Bài viết & FAQ", family: "articles" },
  faq: { title: "FAQ", singular: "câu hỏi", path: "/cms/articles/faq", publicPath: "hoi-dap", area: "Bài viết & FAQ", family: "articles" },
} as const satisfies Record<ContentKind, { title: string; singular: string; path: string; publicPath: string; area: string; family: string }>;
export type ContentSection = keyof typeof contentSections;
export type ContentRoute = { section: ContentSection; view: "list" } | { section: ContentSection; view: "editor"; id?: string } | { section: ContentSection; view: "preview"; id: string };

export function contentRoute(path: string): ContentRoute | null {
  const sections = (Object.keys(contentSections) as ContentSection[]).sort((a, b) => contentSections[b].path.length - contentSections[a].path.length);
  for (const section of sections) {
    const base = contentSections[section].path;
    if (path === base) return { section, view: "list" };
    if (!path.startsWith(base + "/")) continue;
    const tail = path.slice(base.length + 1).split("/");
    if (tail.length === 1 && tail[0] === "new") return { section, view: "editor" };
    // Server resource identifiers are UUIDs. Reject extra segments and prototype routes.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tail[0])) return null;
    if (tail.length === 1) return { section, view: "editor", id: tail[0] };
    if (tail.length === 2 && tail[1] === "preview") return { section, view: "preview", id: tail[0] };
    return null;
  }
  return null;
}
