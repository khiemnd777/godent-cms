import type { M4Locale } from "../../api/src/contracts/m4";
import type { RichTextDocument } from "../../api/src/contracts/s03";
import { RichText } from "./rich-text";
export function SignatureProse({ document, locale, id = "article" }: { document: RichTextDocument; locale: M4Locale; id?: string }) {
  const headings = document.blocks.flatMap((block, index) => block.type === "heading" ? [{ index, text: block.children.map(node => node.text).join("") }] : []);
  return <>{headings.length > 1 && <details className="signature-toc" open><summary>{locale === "en" ? "On this page" : "Nội dung bài viết"}</summary><ol>{headings.map(heading => <li key={heading.index}><a href={`#${id}-${heading.index}`}>{heading.text}</a></li>)}</ol></details>}<RichText document={document} headingPrefix={id}/></>;
}
