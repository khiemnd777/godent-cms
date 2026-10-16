"use client";

export default function PublicContentError({ reset }: { reset: () => void }) {
  return <main className="content-page"><h1>Chưa thể tải nội dung</h1><p>Nội dung hiện chưa tải được. Vui lòng thử lại.</p><button type="button" onClick={reset}>Thử lại</button></main>;
}
