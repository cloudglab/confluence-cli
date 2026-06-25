export interface MarkMetadataInput {
  space: string;
  title?: string;
  parents?: string[];
  labels?: string[];
  attachments?: string[];
}

export function createMarkMetadata(input: MarkMetadataInput): string {
  const lines = [`<!-- Space: ${escapeCommentValue(input.space)} -->`];
  if (input.title) lines.push(`<!-- Title: ${escapeCommentValue(input.title)} -->`);
  for (const parent of input.parents ?? []) lines.push(`<!-- Parent: ${escapeCommentValue(parent)} -->`);
  for (const label of input.labels ?? []) lines.push(`<!-- Label: ${escapeCommentValue(label)} -->`);
  for (const attachment of input.attachments ?? []) lines.push(`<!-- Attachment: ${escapeCommentValue(attachment)} -->`);
  return lines.join("\n");
}

/**
 * HTML 注释 `<!-- ... -->` 遇到 `-->` 会提前闭合,导致后续内容被当成正文。
 * 把值里的 `-->` 转义成 `--\>`,读取方按原规则还原即可。
 */
function escapeCommentValue(value: string): string {
  return value.replace(/-->/g, "--\\>");
}

export function removeMarkMetadata(content: string): string {
  return content.replace(/^<!--\s*(Space|Title|Parent|Label|Attachment):.*?-->\s*\r?\n/gim, "");
}
