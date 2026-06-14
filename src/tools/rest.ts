import { z } from "zod";
import { CONFLUENCE_7_13_7_ENDPOINTS, findEndpoint } from "../api/endpoints.js";
import type { RestMethod } from "../api/endpoints.js";
import { getApi } from "../core/api-provider.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { previewOrAssertWriteAllowed } from "../core/write-guard.js";
import { jsonResult } from "../utils/result.js";

const jsonRecordSchema = z.record(z.unknown());

export function registerRestTools(registry: CliRegistry): void {
  registry.tool(
    "listRestApis",
    z.object({ method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(), group: z.string().optional(), write: z.boolean().optional(), limit: z.number().int().positive().max(500).optional() }),
    ({ method, group, write, limit }) => {
      const endpoints = CONFLUENCE_7_13_7_ENDPOINTS.filter((endpoint) => {
        if (method && endpoint.method !== method) return false;
        if (group && endpoint.group !== group) return false;
        if (write !== undefined && endpoint.write !== write) return false;
        return true;
      });
      return jsonResult({ version: "7.13.7", total: endpoints.length, endpoints: limit ? endpoints.slice(0, limit) : endpoints });
    },
    "List Confluence 7.13.7 REST API endpoints",
  );

  registry.tool(
    "callRestApi",
    z.object({
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      path: z.string(),
      pathParams: jsonRecordSchema.default({}),
      query: jsonRecordSchema.default({}),
      body: z.unknown().optional(),
      confirm: z.boolean().default(false),
    }),
    async (input) => {
      const method = input.method as RestMethod;
      const endpoint = findEndpoint(method, input.path);
      if (!endpoint) {
        throw new Error(`Unsupported Confluence 7.13.7 endpoint: ${method} ${input.path}. Use listRestApis to inspect supported templates.`);
      }

      const pathParams = input.pathParams ?? {};
      const query = input.query ?? {};
      const resolvedPath = applyPathParams(endpoint.path, pathParams);
      if (endpoint.write) {
        const preview = previewOrAssertWriteAllowed({ action: `callRestApi:${method} ${endpoint.path}`, confirm: input.confirm, payload: { method, path: endpoint.path, resolvedPath, query, body: input.body } });
        if (preview) return jsonResult(preview);
      }

      return jsonResult(await getApi().request(method, resolvedPath, query, input.body));
    },
    "Call any listed Confluence 7.13.7 REST API endpoint; writes require confirm=true",
  );
}

function applyPathParams(path: string, params: Record<string, unknown>): string {
  return path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") throw new Error(`Missing path parameter: ${key}`);
    return encodeURIComponent(String(value));
  });
}
