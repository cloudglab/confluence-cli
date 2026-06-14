export interface MarkMetadataInput {
  space: string;
  title?: string;
  parents?: string[];
  labels?: string[];
  attachments?: string[];
}

export function createMarkMetadata(input: MarkMetadataInput): string {
  const lines = [`<!-- Space: ${input.space} -->`];
  if (input.title) lines.push(`<!-- Title: ${input.title} -->`);
  for (const parent of input.parents ?? []) lines.push(`<!-- Parent: ${parent} -->`);
  for (const label of input.labels ?? []) lines.push(`<!-- Label: ${label} -->`);
  for (const attachment of input.attachments ?? []) lines.push(`<!-- Attachment: ${attachment} -->`);
  return lines.join("\n");
}

export function removeMarkMetadata(content: string): string {
  return content.replace(/^<!--\s*(Space|Title|Parent|Label|Attachment):.*?-->\s*\r?\n/gim, "");
}
