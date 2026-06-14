import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { z } from "zod";
import type { CliRegistry } from "../core/cli-registry.js";
import { parseMarkdown } from "../utils/markdown.js";
import { createMarkMetadata, removeMarkMetadata } from "../utils/mark-metadata.js";
import { textResult } from "../utils/result.js";

export function registerMetadataTools(registry: CliRegistry): void {
  registry.tool(
    "generateMarkMetadata",
    z.object({
      file: z.string(),
      space: z.string(),
      title: z.string().optional(),
      parents: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
      attachments: z.array(z.string()).optional(),
      write: z.boolean().default(false),
    }),
    ({ file, space, title, parents, labels, attachments, write }) => {
      const content = readFileSync(file, "utf8");
      const parsed = parseMarkdown(content, basename(file, extname(file)));
      const header = createMarkMetadata({ space, title: title ?? parsed.title, parents, labels, attachments });
      if (!write) return textResult(header);
      writeFileSync(file, `${header}\n\n${removeMarkMetadata(content)}`);
      return textResult(`Updated ${file}`);
    },
    "Generate or write mark-compatible metadata comments",
  );
}
