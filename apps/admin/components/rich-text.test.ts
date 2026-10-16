import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "./rich-text";
test("private rich text escapes markup and refuses unsafe active links", () => {
  const html = renderToStaticMarkup(createElement(RichText, { document: { type: "doc", version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: '<script>alert("x")</script>' }, { type: "link", text: "unsafe", href: "javascript:alert(1)" }, { type: "link", text: "safe", href: "https://example.invalid/info" }] }] } }));
  expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script"); expect(html).not.toContain("javascript:"); expect(html).toContain('href="https://example.invalid/info"');
});
