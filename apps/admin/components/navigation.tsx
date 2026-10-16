import { LayoutGrid, Layers, Smile, Leaf, FileText, Image, MessageSquare, Settings, Users, Building2, History, type LucideIcon } from "lucide-react";
export type NavItem = { label: string; path: string; icon: LucideIcon; children?: NavItem[] };
export const cmsNavigation: NavItem[] = [
 { label: "Tổng quan", path: "/cms", icon: LayoutGrid },
 { label: "Website", path: "/cms/website", icon: Layers, children: [{ label: "Trang", path: "/cms/pages", icon: FileText }, { label: "Giao diện", path: "/cms/themes", icon: Layers }, { label: "Menu", path: "/cms/menus", icon: Layers }] },
 { label: "Nội dung nha khoa", path: "/cms/content", icon: Smile, children: [{ label: "Dịch vụ", path: "/cms/services", icon: FileText }, { label: "Bác sĩ", path: "/cms/doctors", icon: Users }, { label: "Cơ sở", path: "/cms/locations", icon: Building2 }, { label: "Bảng giá", path: "/cms/pricing", icon: Layers }] },
 { label: "Câu chuyện khách hàng", path: "/cms/stories", icon: Leaf, children: [{ label: "Ca điều trị", path: "/cms/cases", icon: FileText }, { label: "Trước & sau", path: "/cms/before-after", icon: Image }, { label: "Đánh giá", path: "/cms/reviews", icon: MessageSquare }] },
 { label: "Bài viết & FAQ", path: "/cms/articles", icon: FileText }, { label: "Khuyến mãi & Landing", path: "/cms/promotions", icon: Layers }, { label: "Thư viện hình ảnh", path: "/cms/media", icon: Image }, { label: "Yêu cầu tư vấn", path: "/cms/leads", icon: MessageSquare }, { label: "Cài đặt website", path: "/cms/settings", icon: Settings }
];
export const findNavigation = (items: NavItem[], path: string): NavItem | undefined => items.flatMap(item => [item, ...(item.children ?? [])]).find(item => item.path === path);
export const findActiveNavigation = (items: NavItem[], path: string): NavItem | undefined => items.flatMap(item => [item, ...(item.children ?? [])]).filter(item => path === item.path || path.startsWith(`${item.path}/`)).sort((left, right) => right.path.length - left.path.length)[0];

export const platformNavigation: NavItem[] = [
 { label: "Nha khoa", path: "/platform", icon: Building2 },
 { label: "Tài khoản quản trị", path: "/platform/accounts", icon: Users },
 { label: "Tính năng & hạn mức", path: "/platform/limits", icon: Layers },
 { label: "Nhật ký hoạt động", path: "/platform/activity", icon: History },
 { label: "Cấu hình nền tảng", path: "/platform/settings", icon: Settings }
];
