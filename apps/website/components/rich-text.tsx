import type { RichInline, RichTextDocument } from "../../api/src/contracts/s03";
import { safeLink } from "../../api/src/contracts/content";
function Inline({ nodes }: { nodes: RichInline[] }) {
  return nodes.map((node, index) => {
    if (node.type === "link") { try { safeLink(node.href); return <a key={index} href={node.href} rel="noopener noreferrer">{node.text}</a>; } catch { /* Invalid links remain inert text. */ } }
    return <span key={index}>{node.text}</span>;
  });
}
export function RichText({ document }: { document: RichTextDocument }) {
  return <div className="rich-content">{document.blocks.map((block, index) => block.type === "heading" ? <h2 key={index}><Inline nodes={block.children}/></h2> : block.type === "bulletList" ? <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline nodes={item}/></li>)}</ul> : <p key={index}><Inline nodes={block.children}/></p>)}</div>;
}
