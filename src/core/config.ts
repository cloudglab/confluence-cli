import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { ConfluenceConfig } from "../types/common.js";
import { isRecord } from "./value.js";

const CONFIG_DIR = path.join(homedir(), ".confluence");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function normalizeRootUrl(url: string): string {
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return `${trimmed}/rest/api`;
}

export function normalizeConfig(raw: Partial<ConfluenceConfig>): ConfluenceConfig {
  if (!raw.url?.trim()) throw new Error("缺少 Confluence 地址。");

  const url = normalizeRootUrl(raw.url);
  const apiBaseUrl = raw.apiBaseUrl ? raw.apiBaseUrl.replace(/\/+$/, "") : normalizeApiBaseUrl(url);
  const personalToken = normalizeOptionalValue(raw.personalToken);
  const username = normalizeOptionalValue(raw.username);
  const password = normalizeOptionalValue(raw.password);

  if (!personalToken && (!username || !password)) {
    throw new Error("缺少凭证。需要 CONFLUENCE_PAT 或 CONFLUENCE_USERNAME + CONFLUENCE_PASSWORD。");
  }

  return {
    url,
    apiBaseUrl,
    authType: personalToken ? "pat" : "basic",
    username,
    password: personalToken ? undefined : password,
    personalToken,
    source: "~/.confluence/config.json",
  };
}

export function loadConfluenceConfig(): ConfluenceConfig {
  const envConfig: Partial<ConfluenceConfig> = {
    url: normalizeOptionalValue(process.env.CONFLUENCE_URL),
    apiBaseUrl: normalizeOptionalValue(process.env.CONFLUENCE_API_BASE_URL),
    personalToken: normalizeOptionalValue(process.env.CONFLUENCE_PAT) ?? normalizeOptionalValue(process.env.CONFLUENCE_PERSONAL_TOKEN),
    username: normalizeOptionalValue(process.env.CONFLUENCE_USERNAME),
    password: normalizeOptionalValue(process.env.CONFLUENCE_PASSWORD) ?? normalizeOptionalValue(process.env.CONFLUENCE_API_TOKEN),
  };

  const envOverrides = removeEmptyValues(envConfig);
  const hasAnyEnvOverride = Object.keys(envOverrides).length > 0;

  if (envConfig.url && (envConfig.personalToken || (envConfig.username && envConfig.password))) {
    return normalizeConfig(envOverrides);
  }

  if (!existsSync(CONFIG_FILE)) {
    throw new Error(
      "未找到 Confluence 配置。\n" +
      "用法: confluence initConfluence --url https://cf.cloudglab.cn --pat YOUR_TOKEN --save true\n" +
      "或设置环境变量: CONFLUENCE_URL + CONFLUENCE_PAT",
    );
  }

  const raw = readConfigFile();
  if (!hasAnyEnvOverride) return normalizeConfig(raw);

  return normalizeConfig({
    ...raw,
    ...envOverrides,
  });
}

function readConfigFile(): Partial<ConfluenceConfig> {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as unknown;
    if (!isRecord(parsed)) throw new Error("配置内容必须是 JSON 对象");
    return parsed as Partial<ConfluenceConfig>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Confluence 配置文件损坏，请检查 ${CONFIG_FILE}：${message}`);
  }
}

function removeEmptyValues(config: Partial<ConfluenceConfig>): Partial<ConfluenceConfig> {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined && value !== ""),
  ) as Partial<ConfluenceConfig>;
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function saveConfig(config: Partial<ConfluenceConfig>): void {
  const normalized = normalizeConfig(config);
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
}

export function maskConfig(config: ConfluenceConfig): ConfluenceConfig {
  return {
    ...config,
    password: config.password ? maskSecret(config.password) : undefined,
    personalToken: config.personalToken ? maskSecret(config.personalToken) : undefined,
  };
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "********";
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`;
}
