import { S03_LIMITS, type RichBlock, type RichInline, type RichTextDocument } from "../../api/src/contracts/s03";

export function safeLink(href: string) {
  if (!href || href.length > S03_LIMITS.href || !/^https?:\/\//i.test(href) || /^https?:\/\/[^/?#]*@/i.test(href) || /[\s\u0000-\u001f\u007f\\]/.test(href) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(href)) return false;
  try { const url = new URL(href); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
const escapeText = (text: string) => text.replace(/[\\[\]#-]/g, "\\$&");
function inlineSource(children: RichInline[]) {
  return children.map(node => node.type === "text" ? escapeText(node.text) : `[${escapeText(node.text)}](${node.href.replaceAll("(", "%28").replaceAll(")", "%29")})`).join("");
}
export function documentSource(document: RichTextDocument) {
  return document.blocks.map(block => block.type === "bulletList" ? block.items.map(item => `- ${inlineSource(item)}`).join("\n") : `${block.type === "heading" ? "## " : ""}${inlineSource(block.children)}`).join("\n");
}
export function visibleText(document: RichTextDocument) {
  return document.blocks.map(block => block.type === "bulletList" ? block.items.map(item => item.map(node => node.text).join("")).join("\n") : block.children.map(node => node.text).join("")).join("\n");
}
function parseInline(source: string): RichInline[] {
  const nodes: RichInline[] = []; let text = "";
  const flush = () => { if (text) nodes.push({ type: "text", text }); text = ""; };
  for (let index = 0; index < source.length;) {
    if (source[index] === "\\" && index + 1 < source.length && /[\\[\]#-]/.test(source[index + 1])) { text += source[index + 1]; index += 2; continue; }
    if (source[index] === "[") {
      const match = /^\[((?:\\.|[^\]\\])*)\]\(([^)\n]+)\)/.exec(source.slice(index));
      if (match) {
        if (!safeLink(match[2])) throw new Error("Liên kết chỉ chấp nhận địa chỉ HTTP hoặc HTTPS hợp lệ, không chứa tài khoản.");
        flush(); nodes.push({ type: "link", text: match[1].replace(/\\([\\[\]#-])/g, "$1"), href: match[2] }); index += match[0].length; continue;
      }
    }
    text += source[index++];
  }
  flush(); if (nodes.length > S03_LIMITS.inlines) throw new Error("Đoạn văn có quá nhiều liên kết.");
  return nodes.length ? nodes : [{ type: "text", text: "" }];
}
export function sourceDocument(source: string, limit: number = S03_LIMITS.bodyText): RichTextDocument {
  if (source.length > 100_000 || source.includes("\0")) throw new Error("Nội dung vượt giới hạn hoặc chứa ký tự không hợp lệ.");
  const blocks: RichBlock[] = []; let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) }); paragraph = []; };
  for (const line of source.split("\n")) {
    if (line.startsWith("## ")) { flush(); blocks.push({ type: "heading", children: parseInline(line.slice(3)) }); }
    else if (line.startsWith("- ")) {
      flush(); const previous = blocks.at(-1);
      if (previous?.type === "bulletList") previous.items.push(parseInline(line.slice(2)));
      else blocks.push({ type: "bulletList", items: [parseInline(line.slice(2))] });
    } else if (!line && paragraph.length) { paragraph.push(""); }
    else paragraph.push(line);
  }
  flush();
  const document: RichTextDocument = { type: "doc", version: 1, blocks };
  if (blocks.length > S03_LIMITS.blocks || blocks.some(block => block.type === "bulletList" && block.items.length > S03_LIMITS.listItems)) throw new Error("Nội dung có quá nhiều đoạn hoặc mục danh sách.");
  if (visibleText(document).length > limit) throw new Error(`Nội dung tối đa ${limit.toLocaleString("vi-VN")} ký tự hiển thị.`);
  return document;
}
