import { z } from "zod";
import { getApi } from "../core/api-provider.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { jsonResult, listResult } from "../utils/result.js";

export function registerSpaceTools(registry: CliRegistry): void {
  const getCurrentUser = async () => {
    return jsonResult(await getApi().getCurrentUser());
  };

  registry.tool(
    "listSpaces",
    { limit: z.number().int().positive().max(100).default(25) },
    async ({ limit }) => {
      const effectiveLimit = limit ?? 25;
      const data = await getApi().listSpaces(effectiveLimit);
      return jsonResult(
        listResult(data.results, {
          source: "rest",
          page: 1,
          limit: effectiveLimit,
          total: data.size,
          itemKey: "spaces",
        }),
      );
    },
    "List Confluence spaces",
  );

  registry.tool(
    "getSpace",
    { spaceKey: z.string() },
    async ({ spaceKey }) => {
      return jsonResult(await getApi().getSpace(spaceKey));
    },
    "Get one Confluence space by key",
  );

  registry.tool(
    "getCurrentUser",
    {},
    getCurrentUser,
    "Get current authenticated Confluence user",
  );

  registry.tool(
    "whoami",
    {},
    getCurrentUser,
    "Show current authenticated Confluence user",
  );

  registry.tool(
    "who-am-i",
    {},
    getCurrentUser,
    "Alias of whoami",
  );

  registry.tool(
    "convertContentBody",
    { to: z.enum(["storage", "view", "export_view", "styled_view"]), value: z.string(), representation: z.enum(["wiki", "storage", "view"]).default("wiki") },
    async ({ to, value, representation }) => {
      return jsonResult(await getApi().convertBody(to, { value, representation: representation ?? "wiki" }));
    },
    "Convert Confluence content body representation",
  );
}
