"use client";
export default function PublicError({ reset }: { reset: () => void }) { return <main><h1>Chưa thể tải trang</h1><p>Vui lòng thử lại sau.</p><button type="button" onClick={reset}>Thử lại</button></main>; }
