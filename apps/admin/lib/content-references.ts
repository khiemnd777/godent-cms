import { M3_LIMITS, type ContentReference } from "../../api/src/contracts/m3";

/** Picking the same resource is an explicit update of its pinned publication. */
export function chooseReference(selected: ContentReference[], candidate: ContentReference, self?: string) {
  if (candidate.id === self) throw new Error("Nội dung không thể tự liên kết.");
  const index = selected.findIndex(item => item.id === candidate.id && item.kind === candidate.kind);
  const reference = { kind: candidate.kind, id: candidate.id, publicationId: candidate.publicationId };
  if (index >= 0) return selected.map((item, at) => at === index ? reference : item);
  if (selected.length >= M3_LIMITS.references) throw new Error("Tối đa 50 nội dung liên kết.");
  return [...selected, reference];
}
export function moveReference<T>(selected: T[], index: number, direction: -1 | 1) {
  const next = index + direction; if (index < 0 || index >= selected.length || next < 0 || next >= selected.length) return selected;
  const result = [...selected]; [result[index], result[next]] = [result[next], result[index]]; return result;
}
