import type { ContentDraft, DentalContent } from "../../api/src/contracts/m3";
import { documentSource } from "./rich-text";
export function permissionRefreshState(draft: ContentDraft, input: { content: DentalContent; body: string; dirty: boolean }) {
  return { draft, content: input.dirty ? input.content : draft.content, body: input.dirty ? input.body : documentSource(draft.content.body) };
}
