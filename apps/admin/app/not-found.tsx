import Link from "next/link";
import { ShellState } from "../components/shell-state";
export default function NotFound() { return <main className="standalone"><ShellState title="Trang không tồn tại" description="Kiểm tra lại đường dẫn hoặc trở về trang tổng quan."><Link href="/cms" className="btn">Về tổng quan</Link></ShellState></main>; }
