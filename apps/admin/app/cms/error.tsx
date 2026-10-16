"use client";
import { ShellState } from "../../components/shell-state";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ShellState kind="error" title="Không thể tải nội dung" description="Vui lòng thử tải lại trang."><button className="btn" onClick={reset}>Thử lại</button></ShellState>; }
