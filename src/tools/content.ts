import { z } from "zod";
import { getApi } from "../core/api-provider.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { previewOrAssertWriteAllowed } from "../core/write-guard.js";
import { jsonResult } from "../utils/result.js";

export function registerContentTools(registry: CliRegistry): void {
  registry.tool(
    "searchContent",
    z.object({ cql: z.string(), limit: z.number().int().positive().max(100).default(25) }),
    async ({ cql, limit }) => {
      return jsonResult(await getApi().search(cql, limit));
    },
    "Search Confluence content with CQL",
  );

  registry.tool(
    "getContent",
    z.object({ id: z.coerce.string(), expand: z.string().optional() }),
    async ({ id, expand }) => {
      return jsonResult(await getApi().getContent(id, expand));
    },
    "Get one Confluence page/content by id",
  );

  registry.tool(
    "findContent",
    z.object({ space: z.string().optional(), title: z.string().optional(), type: z.string().default("page"), limit: z.number().int().positive().max(100).default(25), expand: z.string().optional() }),
    async ({ space, title, type, limit, expand }) => {
      return jsonResult(await getApi().findContent({ space, title, type, limit, expand }));
    },
    "Find content by title, space or type",
  );

  registry.tool(
    "deleteContent",
    z.object({ id: z.coerce.string(), confirm: z.boolean().default(false) }),
    async ({ id, confirm }) => {
      const preview = previewOrAssertWriteAllowed({ action: "deleteContent", confirm, payload: { id } });
      if (preview) return jsonResult(preview);
      return jsonResult(await getApi().deleteContent(id));
    },
    "Delete Confluence content; requires confirm=true",
  );

  registry.tool(
    "getPageChildren",
    z.object({ id: z.coerce.string(), type: z.string().optional(), expand: z.string().default("space,version"), limit: z.number().int().positive().max(100).default(25) }),
    async ({ id, type, expand, limit }) => {
      return jsonResult(await getApi().getChildren(id, type, expand, limit));
    },
    "Get page children, optionally filtered by child type",
  );

  registry.tool(
    "getComments",
    z.object({ id: z.coerce.string(), expand: z.string().default("body.storage,version"), limit: z.number().int().positive().max(100).default(25) }),
    async ({ id, expand, limit }) => {
      return jsonResult(await getApi().getComments(id, expand, limit));
    },
    "Get page comments",
  );

  registry.tool(
    "addComment",
    z.object({
      id: z.coerce.string(),
      body: z.string(),
      inline: z.string().optional().describe("Selected text on the page to annotate (inline comment)"),
      representation: z.enum(["wiki", "storage"]).default("wiki"),
      confirm: z.boolean().default(false),
    }),
    async ({ id, body, inline, representation, confirm }) => {
      const bodyRepresentation = representation ?? "wiki";
      const action = inline ? "addInlineComment" : "addComment";
      const preview = previewOrAssertWriteAllowed({ action, confirm, payload: { id, inline: inline ?? undefined, representation: bodyRepresentation, bodyPreview: body.slice(0, 500) } });
      if (preview) return jsonResult(preview);
      if (inline) {
        return jsonResult(
          await getApi().addInlineComment({ pageId: id, selection: inline, body, representation: bodyRepresentation }),
        );
      }
      return jsonResult(await getApi().addComment({ pageId: id, body, representation: bodyRepresentation }));
    },
    "Add a comment to a page; use --inline to annotate selected text; requires confirm=true",
  );
}
