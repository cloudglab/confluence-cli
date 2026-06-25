import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import type { ConfluenceAttachment } from "../api/index.js";
import { getApi } from "../core/api-provider.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { previewOrAssertWriteAllowed } from "../core/write-guard.js";
import { jsonResult, textResult } from "../utils/result.js";

export function registerAttachmentTools(registry: CliRegistry): void {
  registry.tool(
    "listAttachments",
    { id: z.coerce.string(), limit: z.number().int().positive().max(100).default(100) },
    async ({ id, limit }) => {
      return jsonResult(await getApi().listAttachments(id, limit));
    },
    "List page attachments",
  );

  registry.tool(
    "uploadAttachment",
    { id: z.coerce.string(), file: z.string(), comment: z.string().optional(), minorEdit: z.boolean().default(true), confirm: z.boolean().default(false) },
    async ({ id, file, comment, minorEdit, confirm }) => {
      const preview = previewOrAssertWriteAllowed({ action: "uploadAttachment", confirm, payload: { id, file, comment, minorEdit } });
      if (preview) return jsonResult(preview);
      return jsonResult(await getApi().uploadAttachment({ pageId: id, filename: basename(file), data: readFileSync(file), comment, minorEdit }));
    },
    "Upload an attachment to a page; requires confirm=true",
  );

  registry.tool(
    "updateAttachment",
    { id: z.coerce.string(), attachmentId: z.coerce.string(), file: z.string(), comment: z.string().optional(), minorEdit: z.boolean().default(true), confirm: z.boolean().default(false) },
    async ({ id, attachmentId, file, comment, minorEdit, confirm }) => {
      const preview = previewOrAssertWriteAllowed({ action: "updateAttachment", confirm, payload: { id, attachmentId, file, comment, minorEdit } });
      if (preview) return jsonResult(preview);
      return jsonResult(await getApi().updateAttachmentData({ pageId: id, attachmentId, filename: basename(file), data: readFileSync(file), comment, minorEdit }));
    },
    "Update attachment data; requires confirm=true",
  );

  registry.tool(
    "downloadAttachment",
    { id: z.coerce.string(), attachmentId: z.coerce.string().optional(), title: z.string().optional(), outputDir: z.string().default(".") },
    async ({ id, attachmentId, title, outputDir }) => {
      if (!attachmentId && !title) {
        throw new Error("Provide attachmentId or title");
      }
      const targetDir = outputDir ?? ".";
      const api = getApi();
      const attachments = await api.listAttachments(id, 100);
      const attachment = attachments.results.find((item) => matchesAttachment(item, attachmentId, title));
      if (!attachment) throw new Error("Attachment not found.");
      const downloadPath = attachment._links?.download;
      if (!downloadPath) throw new Error("Attachment has no download link.");
      mkdirSync(targetDir, { recursive: true });
      const outputPath = join(targetDir, safeFileName(attachment.title));
      const downloaded = await api.downloadAttachment(downloadPath);
      writeFileSync(outputPath, downloaded.data);
      return textResult(outputPath);
    },
    "Download one page attachment by id or title",
  );
}

function matchesAttachment(attachment: ConfluenceAttachment, attachmentId?: string, title?: string): boolean {
  return (attachmentId !== undefined && attachment.id === attachmentId) || (title !== undefined && attachment.title === title);
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}
