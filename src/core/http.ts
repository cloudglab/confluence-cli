import axios, { type AxiosInstance } from "axios";
import type { RestMethod } from "../api/endpoints.js";
import type { ConfluenceConfig } from "../types/common.js";

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

export class ConfluenceHttpClient {
  private readonly client: AxiosInstance;

  constructor(config: ConfluenceConfig) {
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30_000,
      auth: config.authType === "basic" ? { username: config.username!, password: config.password! } : undefined,
      headers: {
        Accept: "application/json",
        ...(config.authType === "pat" ? { Authorization: `Bearer ${config.personalToken}` } : {}),
      },
    });
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.get<T>(path, { params });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    try {
      const response = await this.client.post<T>(path, data, { headers: { "Content-Type": "application/json" } });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    try {
      const response = await this.client.put<T>(path, data, { headers: { "Content-Type": "application/json" } });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  }

  async delete<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.delete<T>(path, { params });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  }

  async request<T>(method: RestMethod, path: string, params?: Record<string, unknown>, data?: unknown): Promise<T> {
    try {
      const response = await this.client.request<T>({ method, url: path, params, data, headers: data === undefined ? undefined : { "Content-Type": "application/json" } });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  }

  async postMultipart<T>(path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    return this.multipart<T>("POST", path, fields, files);
  }

  async putMultipart<T>(path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    return this.multipart<T>("PUT", path, fields, files);
  }

  async getBuffer(path: string, params?: Record<string, unknown>): Promise<{ data: Buffer; headers: Record<string, unknown> }> {
    try {
      const response = await this.client.get<ArrayBuffer>(path, { params, responseType: "arraybuffer" });
      return { data: Buffer.from(response.data), headers: response.headers as Record<string, unknown> };
    } catch (error) {
      throw normalizeHttpError(error);
    }
  }

  private async multipart<T>(method: "POST" | "PUT", path: string, fields: Record<string, string | boolean | number | undefined>, files: MultipartFile[]): Promise<T> {
    const boundary = `----confluence-cli-${Date.now().toString(16)}`;
    const body = buildMultipartBody(boundary, fields, files);
    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data: body,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
          "X-Atlassian-Token": "no-check",
        },
      });
      return response.data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  }
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
