import { randomUUID } from "node:crypto";

/**
 * Inline comment marker format for Confluence 7.13.7 (Server/Data Center):
 *
 * The page body storage format uses:
 *   <ac:inline-comment-marker ac:ref="ref-id">selected text</ac:inline-comment-marker>
 *
 * The comment is linked via `extensions.inlineProperties.inlineMarkerRef`.
 *
 * Known limitations:
 * - Selection text must be contiguously present in the storage format body
 * - Selection spanning XML element boundaries (e.g., across <strong>/</strong>) will fail
 * - Selection within macros (ac:structured-macro) or links (ac:link) will fail
 */

export interface InlineAnnotationResult {
  annotatedBody: string;
  markerRef: string;
}

export function generateMarkerRef(): string {
  return `ic-${randomUUID().slice(0, 8)}`;
}

/**
 * Find `selection` in the storage format body and wrap it with an inline-comment-marker.
 * Returns null if the selection cannot be safely annotated.
 */
export function findAndAnnotateSelection(
  storageBody: string,
  selection: string,
  markerRef?: string,
): InlineAnnotationResult | null {
  if (!selection || selection.trim().length === 0) return null;

  const index = storageBody.indexOf(selection);
  if (index === -1) return null;

  // Safety: don't insert marker if it would split an XML tag
  const charBefore = index > 0 ? storageBody[index - 1] : "";
  const charAfter =
    index + selection.length < storageBody.length
      ? storageBody[index + selection.length]
      : "";

  if (charBefore === "<" || charAfter === ">") return null;

  const ref = markerRef ?? generateMarkerRef();
  const marker = `<ac:inline-comment-marker ac:ref="${ref}">${selection}</ac:inline-comment-marker>`;
  const annotatedBody =
    storageBody.slice(0, index) + marker + storageBody.slice(index + selection.length);

  return { annotatedBody, markerRef: ref };
}
