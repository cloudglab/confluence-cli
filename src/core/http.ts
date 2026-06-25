import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { pipeline } from "node:stream/promises";
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { RestMethod } from "../api/endpoints.js";
import type { ConfluenceConfig } from "../types/common.js";
import { recordCacheHit, recordRequest, recordRetry } from "./http-metrics.js";

export interface MultipartFile {
  fieldName: string;
  filename: string;
  contentType?: string;
  data: Buffer;
}

export interface HttpError extends Error {
  statusCode?: number;
  responseBody?: unknown;
}

interface CacheEntry {
  body: unknown;
  expiresAt: number;
}

const GET_CACHE_TTL_MS = 15_000;
const GET_CACHE_MAX_SIZE = 128;
const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED", "EPIPE"]);
const RETRY_DELAY_MS = 100;
const ERROR_BODY_PREVIEW_LIMIT = 500;

/**
 * Confluence HTTP 客户端。对齐 zentao-cli 的 `ZentaoHttpClient`:
 *
 * - GET 15s 缓存(模块级 Map,LRU + maxSize 上限,避免无限增长)
 * - 网络层错误(EAI_AGAIN / ECONNRESET / ...)重试 1 次;Basic 模式 401 重试 1 次
 * - keep-alive http/https Agent(对齐 zentao-cli)
 *
 * 401 重试机制:仅 Basic 模式触发(清 auth 后让 axios 重新发起 challenge);
 * PAT 模式**不重试 401**——Bearer token 写死在构造时的 headers 里,
 * "清 token" 等价于 no-op,且修改共享 axios defaults 会污染后续所有请求
 * (getPageSnapshot 并发 5 个 GET 时任一 401 会竞态清掉其他 4 个的凭证)。
 * 上层如需动态刷新 PAT,请在构造新 client 时重设,而非依赖重试清凭证。
 */
export class ConfluenceHttpClient {
  private readonly client: AxiosInstance;
  private readonly getCache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfluenceConfig) {
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30_000,
      auth: config.authType === "basic" ? { username: config.username!, password: config.password! } : undefined,
      headers: {
        Accept: "application/json",
        ...(config.authType === "pat" ? { Authorization: `Bearer ${config.personalToken}` } : {}),
      },
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });
  }

  /**
   * 401 重试前调用。Basic 模式清 auth 字段后,axios 会按当前 config 重新发起 Basic challenge。
   * PAT 模式为 no-op:Bearer 写死在 headers,清不掉也不该改共享 defaults。
   */
  clearCredentials(): void {
    if (this.config.authType === "basic") {
      this.client.defaults.auth = undefined;
    }
    // PAT 模式:见类注释,不触碰共享 axios defaults。
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const cacheKey = this.makeCacheKey("GET", path, params);
    const cached = this.lookupCache<T>(cacheKey);
    if (cached !== undefined) {
      recordCacheHit();
      return cached;
    }
    const body = await this.runWithMetrics(() => this.executeWithRetry<T>("GET", path, { params }));
    this.setCache(cacheKey, body);
    return body;
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    return this.runWithMetrics(() => this.executeWithRetry<T>("POST", path, { data, headers: { "Content-Type": "application/json" } }));
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    return this.runWithMetrics(() => this.executeWithRetry<T>("PUT", path, { data, headers: { "Content-Type": "application/json" } }));
  }

  async delete<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.runWithMetrics(() => this.executeWithRetry<T>("DELETE", path, { params }));
  }

  async request<T>(method: RestMethod, path: string, params?: Record<string, unknown>, data?: unknown): Promise<T> {
    if (method === "GET") {
      const cacheKey = this.makeCacheKey("GET", path, params);
      const cached = this.lookupCache<T>(cacheKey);
      if (cached !== undefined) {
        recordCacheHit();
        return cached;
      }
    }
    const body = await this.runWithMetrics(() => this.executeWithRetry<T>(method, path, {
      params,
      data,
      headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    }));
    if (method === "GET") {
      this.setCache(this.makeCacheKey("GET", path, params), body);
    }
    return body;
  }

  async postMultipart<T>(path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    return this.multipart<T>("POST", path, fields, files);
  }

  async putMultipart<T>(path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    return this.multipart<T>("PUT", path, fields, files);
  }

  async getBuffer(path: string, params?: Record<string, unknown>): Promise<{ data: Buffer; headers: Record<string, unknown> }> {
    return this.runWithMetrics(async () => {
      const response = await this.executeWithRetryResponse<ArrayBuffer>("GET", path, { params, responseType: "arraybuffer" });
      return { data: Buffer.from(response.data), headers: response.headers as Record<string, unknown> };
    });
  }

  /**
   * 流式下载到文件,避免大附件(~500MB)全量进内存。
   * 失败时清理半成品目标文件;401 重试仅 Basic 模式触发(见类注释)。
   */
  async downloadToFile(path: string, destPath: string, params?: Record<string, unknown>): Promise<{ headers: Record<string, unknown> }> {
    return this.runWithMetrics(async () => {
      const response = await this.executeWithRetryResponse<unknown>("GET", path, { params, responseType: "stream" });
      await this.streamToFile(response.data, destPath);
      return { headers: response.headers as Record<string, unknown> };
    });
  }

  private async multipart<T>(method: "POST" | "PUT", path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    const boundary = `----confluence-cli-${Date.now().toString(16)}`;
    const body = buildMultipartBody(boundary, fields, files);
    return this.runWithMetrics(() => this.executeWithRetry<T>(method, path, {
      data: body,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
        "X-Atlassian-Token": "no-check",
      },
    }));
  }

  /**
   * 单次请求指标统计(对齐 zentao-cli):`recordRequest` 只在最终成功/失败调一次,
   * 重试(网络层 / 401)单独走 `recordRetry()`,避免一次逻辑请求被计成多次。
   */
  private async runWithMetrics<T>(action: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await action();
      recordRequest(Date.now() - start, true);
      return result;
    } catch (error) {
      recordRequest(Date.now() - start, false);
      throw normalizeHttpError(error);
    }
  }

  private async executeWithRetry<T>(method: RestMethod, path: string, config: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetryResponse<T>(method, path, config);
    return response.data;
  }

  private async executeWithRetryResponse<T>(method: RestMethod, path: string, config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const run = () => this.executeWithNetworkRetry<T>(() => this.client.request<T>({ method, url: path, ...config }));
    try {
      return await run();
    } catch (error) {
      if (this.config.authType === "basic" && axios.isAxiosError(error) && error.response?.status === 401) {
        this.clearCredentials();
        recordRetry();
        return run();
      }
      throw error;
    }
  }

  /**
   * 网络层错误(`ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` / `ECONNREFUSED` / `EPIPE`)
   * 重试 1 次。HTTP 4xx/5xx 直接抛错,不重试(语义明确,交给上层处理)。
   */
  private async executeWithNetworkRetry<T>(action: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    try {
      return await action();
    } catch (error) {
      if (!isRetryableNetworkError(error)) throw error;
      recordRetry();
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return action();
    }
  }

  private async streamToFile(stream: unknown, destPath: string): Promise<void> {
    const out = createWriteStream(destPath);
    try {
      await pipeline(stream as NodeJS.ReadableStream, out);
    } catch (error) {
      out.destroy();
      await rm(destPath, { force: true }).catch(() => {
        // 清理半成品文件失败不应掩盖原始下载错误
      });
      throw error;
    }
  }

  private makeCacheKey(method: string, path: string, params?: Record<string, unknown>): string {
    const sorted = params ? sortParams(params) : undefined;
    return `${method} ${path} ${sorted ? JSON.stringify(sorted) : ""}`;
  }

  private lookupCache<T>(key: string): T | undefined {
    const entry = this.getCache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.getCache.delete(key);
      return undefined;
    }
    // LRU:命中时移到末尾(最近使用),Map 按插入序维护。
    this.getCache.delete(key);
    this.getCache.set(key, entry);
    return entry.body as T;
  }

  private setCache(key: string, body: unknown): void {
    if (this.getCache.size >= GET_CACHE_MAX_SIZE) {
      const oldestKey = this.getCache.keys().next().value;
      if (oldestKey !== undefined) this.getCache.delete(oldestKey);
    }
    this.getCache.set(key, { body, expiresAt: Date.now() + GET_CACHE_TTL_MS });
  }
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.response) return false;
  const code = error.code;
  return typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code);
}

function sortParams(params: Record<string, unknown>): Record<string, unknown> {
  // 用纯字符比较,避免 localeCompare 在不同运行环境/locale 下产生不同的缓存键。
  const sortedEntries = Object.entries(params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const result: Record<string, unknown> = {};
  for (const [key, value] of sortedEntries) {
    result[key] = value;
  }
  return result;
}

function buildMultipartBody(boundary: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Buffer {
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${escapeMultipartName(name)}"\r\n\r\n${String(value)}\r\n`));
  }
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${escapeMultipartName(file.fieldName)}"; filename="${escapeMultipartName(file.filename)}"\r\nContent-Type: ${file.contentType ?? "application/octet-stream"}\r\n\r\n`,
      ),
      file.data,
      Buffer.from("\r\n"),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function escapeMultipartName(value: string): string {
  return value.replace(/["\\\r\n]/g, "_");
}

function normalizeHttpError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const responseBody = error.response?.data;
    const rawBody = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody ?? {});
    // 生产模式下错误信息里只保留前 500 字符响应体预览,避免巨型 HTML/JSON 错误页爆掉日志和 message。
    const body = rawBody.length > ERROR_BODY_PREVIEW_LIMIT
      ? `${rawBody.slice(0, ERROR_BODY_PREVIEW_LIMIT)}…(${rawBody.length} bytes)`
      : (rawBody || error.message);
    const normalized = new Error(`Confluence request failed${status ? ` (${status})` : ""}: ${body}`) as HttpError;
    normalized.statusCode = status;
    normalized.responseBody = responseBody;
    return normalized;
  }
  return error instanceof Error ? error : new Error(String(error));
}
