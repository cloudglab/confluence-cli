import http from "node:http";
import https from "node:https";
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
const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED", "EPIPE"]);
const RETRY_DELAY_MS = 100;

/**
 * Confluence HTTP 客户端。对齐 zentao-cli 的 `ZentaoHttpClient`:
 *
 * - GET 15s 缓存(模块级 Map)
 * - 网络层错误(EAI_AGAIN / ECONNRESET / ...)+ HTTP 401 各重试 1 次
 * - keep-alive http/https Agent(对齐 zentao-cli)
 *
 * 401 重试机制:Confluence 同时支持 PAT (Bearer) 和 Basic Auth,
 * PAT 模式下"清 token"实际无操作可做(Bearer token 写在构造时的 headers 里),
 * 仍然重发同请求一次,以保留与 zentao-cli 一致的失败兜底形态;
 * 如果上层把 Authorization 改为动态注入,可订阅 `clearCredentials` 在重试前重置。
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
   * 401 重试前调用。PAT 模式下清 token 等价于 no-op(Bearer 写死在 headers),
   * Basic 模式下清 auth 字段后,axios 会按当前 config 重新发起 Basic challenge。
   * 也提供钩子供上层在重试前刷新凭证(如重新加载 ~/.confluence/config.json)。
   */
  clearCredentials(): void {
    if (this.config.authType === "basic") {
      this.client.defaults.auth = undefined;
    } else {
      delete this.client.defaults.headers?.Authorization;
      delete this.client.defaults.headers?.authorization;
    }
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const cacheKey = this.makeCacheKey("GET", path, params);
    const cached = this.lookupCache<T>(cacheKey);
    if (cached !== undefined) {
      recordCacheHit();
      return cached;
    }
    return this.executeWithMetrics("GET", path, { params });
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    return this.executeWithRetry<T>("POST", path, { data, headers: { "Content-Type": "application/json" } });
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    return this.executeWithRetry<T>("PUT", path, { data, headers: { "Content-Type": "application/json" } });
  }

  async delete<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.executeWithRetry<T>("DELETE", path, { params });
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
    return this.executeWithRetry<T>(method, path, {
      params,
      data,
      headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    });
  }

  async postMultipart<T>(path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    return this.multipart<T>("POST", path, fields, files);
  }

  async putMultipart<T>(path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    return this.multipart<T>("PUT", path, fields, files);
  }

  async getBuffer(path: string, params?: Record<string, unknown>): Promise<{ data: Buffer; headers: Record<string, unknown> }> {
    return this.executeWithRetryBuffer("GET", path, { params, responseType: "arraybuffer" });
  }

  private async multipart<T>(method: "POST" | "PUT", path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    const boundary = `----confluence-cli-${Date.now().toString(16)}`;
    const body = buildMultipartBody(boundary, fields, files);
    return this.executeWithRetry<T>(method, path, {
      data: body,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
        "X-Atlassian-Token": "no-check",
      },
    });
  }

  /**
   * 网络层错误重试 1 次 + 401 重试 1 次(清 credentials 后再发一次)。
   */
  private async executeWithRetry<T>(method: RestMethod, path: string, config: AxiosRequestConfig): Promise<T> {
    return this.executeWithAuthRetry<T>(
      method,
      path,
      config,
      () => this.executeWithMetrics<T>(method, path, config),
    );
  }

  private async executeWithRetryBuffer(method: RestMethod, path: string, config: AxiosRequestConfig): Promise<{ data: Buffer; headers: Record<string, unknown> }> {
    return this.executeWithAuthRetry<{ data: Buffer; headers: Record<string, unknown> }>(
      method,
      path,
      config,
      () => this.executeWithMetricsBuffer(method, path, config),
    );
  }

  private async executeWithAuthRetry<T>(
    _method: RestMethod,
    _path: string,
    _config: AxiosRequestConfig,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.clearCredentials();
        return run();
      }
      throw error;
    }
  }

  private async executeWithMetrics<T>(method: RestMethod, path: string, config: AxiosRequestConfig): Promise<T> {
    const start = Date.now();
    try {
      const response = await this.executeWithNetworkRetry<T>(() => this.client.request<T>({ method, url: path, ...config }));
      const body = response.data;
      recordRequest(Date.now() - start, true);
      if (method === "GET") {
        this.getCache.set(this.makeCacheKey("GET", path, config.params), {
          body,
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
        });
      }
      return body;
    } catch (error) {
      recordRequest(Date.now() - start, false);
      throw normalizeHttpError(error);
    }
  }

  private async executeWithMetricsBuffer(method: RestMethod, path: string, config: AxiosRequestConfig): Promise<{ data: Buffer; headers: Record<string, unknown> }> {
    const start = Date.now();
    try {
      const response = await this.executeWithNetworkRetry<ArrayBuffer>(() => this.client.request<ArrayBuffer>({ method, url: path, ...config }));
      recordRequest(Date.now() - start, true);
      return { data: Buffer.from(response.data), headers: response.headers as Record<string, unknown> };
    } catch (error) {
      recordRequest(Date.now() - start, false);
      throw normalizeHttpError(error);
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
    return entry.body as T;
  }
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.response) return false;
  const code = error.code;
  return typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code);
}

function sortParams(params: Record<string, unknown>): Record<string, unknown> {
  const sortedEntries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
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
    const body = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody ?? {});
    const normalized = new Error(`Confluence request failed${status ? ` (${status})` : ""}: ${body || error.message}`) as HttpError;
    normalized.statusCode = status;
    normalized.responseBody = responseBody;
    return normalized;
  }
  return error instanceof Error ? error : new Error(String(error));
}