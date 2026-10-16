import Link from "next/link";
import { headers } from "next/headers";
export default async function NotFound() { const en = (await headers()).get("x-gcms-locale") === "en"; return <main><h1>{en ? "Page not found" : "Trang không tồn tại"}</h1><p>{en ? "Please check the address you want to open." : "Kiểm tra lại địa chỉ bạn muốn truy cập."}</p><Link href="/">{en ? "Back to Godent" : "Về trang đầu"}</Link></main>; }
