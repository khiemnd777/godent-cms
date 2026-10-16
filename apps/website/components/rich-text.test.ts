import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "./rich-text";
test("public renderer keeps text inert and allows only validated HTTP links", () => {
  const html = renderToStaticMarkup(createElement(RichText, { document: { type: "doc", version: 1, blocks: [{ type: "heading", children: [{ type: "text", text: '<img src=x onerror="alert(1)">' }] }, { type: "paragraph", children: [{ type: "link", text: "unsafe", href: "https://@example.invalid" }, { type: "link", text: "safe", href: "https://example.invalid/info" }] }] } }));
  expect(html).toContain("&lt;img"); expect(html).not.toContain("<img"); expect(html).not.toContain('href="https://@'); expect(html).toContain('href="https://example.invalid/info"');
});
