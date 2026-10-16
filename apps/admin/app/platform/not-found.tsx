import Link from "next/link";
import { ShellState } from "../../components/shell-state";
export default function NotFound() { return <ShellState title="Trang không tồn tại" description="Kiểm tra lại đường dẫn hoặc trở về danh sách nha khoa."><Link href="/platform" className="btn">Về danh sách nha khoa</Link></ShellState>; }
