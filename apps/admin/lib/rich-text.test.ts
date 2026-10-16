import { describe, expect, it } from "bun:test";
import { documentSource, sourceDocument, safeLink, visibleText } from "./rich-text";
import type { RichTextDocument } from "../../api/src/contracts/s03";

describe("bounded rich text editing", () => {
  it("preserves legacy literal markup, Markdown, backslashes and line breaks", () => {
    const text = "<script>alert(1)</script>\n## Literal heading\n- literal list\n[text](javascript:alert(1))\\file\n\nLast line";
    const document: RichTextDocument = { type: "doc", version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text }] }] };
    expect(sourceDocument(documentSource(document))).toEqual(document);
  });
  it("round trips heading, list and safe link nodes", () => {
    const document: RichTextDocument = { type: "doc", version: 1, blocks: [
      { type: "heading", children: [{ type: "text", text: "Thông tin" }] },
      { type: "paragraph", children: [{ type: "text", text: "Đọc " }, { type: "link", href: "https://example.invalid/info", text: "hướng dẫn" }] },
      { type: "bulletList", items: [[{ type: "text", text: "Mục một" }], [{ type: "text", text: "Mục hai" }]] },
    ] };
    expect(sourceDocument(documentSource(document))).toEqual(document);
    expect(visibleText(document)).toBe("Thông tin\nĐọc hướng dẫn\nMục một\nMục hai");
  });
  it("rejects unsafe links instead of silently turning them into active nodes", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "//example.invalid", "https://user:pass@example.invalid", "https://@example.invalid", "https://example.invalid/\npath", "https://example.invalid/%0a", "https:example.invalid"]) expect(safeLink(href)).toBe(false);
    expect(() => sourceDocument("[unsafe](javascript:alert%281%29)")).toThrow();
  });
  it("bounds visible text and document structure before transport", () => {
    expect(() => sourceDocument("a".repeat(20_001))).toThrow();
    expect(() => sourceDocument(Array.from({ length: 101 }, () => "## Heading").join("\n"))).toThrow();
    expect(safeLink("https://example.invalid/path?q=1#part")).toBe(true);
  });
});
