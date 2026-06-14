import { z } from "zod";
import { ConfluenceApi } from "../api/index.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { loadConfluenceConfig, maskConfig, normalizeConfig, saveConfig } from "../core/config.js";
import { jsonResult } from "../utils/result.js";

export function registerInitTools(registry: CliRegistry): void {
  registry.tool(
    "initConfluence",
    z.object({
      url: z.string().optional().describe("Confluence 根域名，如 https://cf.cloudglab.cn"),
      pat: z.string().optional().describe("Personal Access Token (Confluence 7.13.7 推荐)"),
      username: z.string().optional().describe("用户名（Basic Auth 兼容）"),
      password: z.string().optional().describe("密码（Basic Auth 兼容）"),
      save: z.boolean().optional().default(false).describe("是否写入 ~/.confluence/config.json"),
    }),
    async (input) => {
      const config = input.url || input.pat || input.username
        ? normalizeConfig({ url: input.url, personalToken: input.pat, username: input.username, password: input.password })
        : loadConfluenceConfig();

      if (input.save) saveConfig(config);

      // 验证连接有效
      const api = new ConfluenceApi(config);
      await api.getCurrentUser();

      return jsonResult({ ok: true, saved: Boolean(input.save), config: maskConfig(config) });
    },
  );
}
