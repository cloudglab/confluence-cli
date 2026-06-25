import { z } from "zod";
import { getApi } from "../core/api-provider.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { previewOrAssertWriteAllowed } from "../core/write-guard.js";
import { jsonResult } from "../utils/result.js";

export function registerLabelTools(registry: CliRegistry): void {
  registry.tool(
    "getLabels",
    { id: z.coerce.string(), limit: z.number().int().positive().max(100).default(100) },
    async ({ id, limit }) => {
      return jsonResult(await getApi().getLabels(id, limit));
    },
    "Get labels for one page/content",
  );

  registry.tool(
    "addLabels",
    { id: z.coerce.string(), labels: z.array(z.string()).min(1), confirm: z.boolean().default(false) },
    async ({ id, labels, confirm }) => {
      const preview = previewOrAssertWriteAllowed({ action: "addLabels", confirm, payload: { id, labels } });
      if (preview) return jsonResult(preview);
      return jsonResult(await getApi().addLabels(id, labels));
    },
    "Add labels to one page/content; requires confirm=true",
  );

  registry.tool(
    "deleteLabel",
    { id: z.coerce.string(), label: z.string(), confirm: z.boolean().default(false) },
    async ({ id, label, confirm }) => {
      const preview = previewOrAssertWriteAllowed({ action: "deleteLabel", confirm, payload: { id, label } });
      if (preview) return jsonResult(preview);
      return jsonResult(await getApi().deleteLabel(id, label));
    },
    "Delete one label from page/content; requires confirm=true",
  );
}
