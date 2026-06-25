import { ConfluenceHttpClient } from "../core/http.js";
import { findAndAnnotateSelection } from "../core/inline-comment.js";
import type { ConfluenceConfig } from "../types/common.js";
import type { RestMethod } from "./endpoints.js";

export interface ContentBody {
  storage?: { value: string; representation: "storage" };
  view?: { value: string; representation: "view" };
  wiki?: { value: string; representation: "wiki" };
}

export interface ConfluenceContent {
  id: string;
  type: string;
  title: string;
  space?: { key: string; name?: string };
  version?: { number: number; by?: { displayName?: string }; when?: string };
  ancestors?: Array<{ id: string; title: string }>;
  body?: ContentBody;
  _links?: Record<string, string>;
}

export interface ConfluencePage<T> {
  results: T[];
  size: number;
  limit?: number;
  start?: number;
  _links?: Record<string, string>;
}

export interface ConfluenceLabel {
  prefix?: string;
  name: string;
}

export interface ConfluenceAttachment {
  id: string;
  type: "attachment";
  title: string;
  version?: { number: number };
  metadata?: { mediaType?: string };
  _links?: Record<string, string>;
}

export class ConfluenceApi {
  private readonly http: ConfluenceHttpClient;

  constructor(config: ConfluenceConfig) {
    this.http = new ConfluenceHttpClient(config);
  }

  search(cql: string, limit = 25): Promise<{ results: ConfluenceContent[]; size: number }> {
    return this.http.get("/content/search", { cql, limit, expand: "space,version" });
  }

  getReport(input: {
    cql: string;
    start?: number;
    limit?: number;
    expand?: string;
  }): Promise<ConfluencePage<ConfluenceContent>> {
    return this.http.request("GET", "/content/search", {
      cql: input.cql,
      start: input.start ?? 0,
      limit: input.limit ?? 25,
      expand: input.expand ?? "space,history,history.lastUpdated,metadata.labels",
    });
  }

  getContent(id: string, expand = "body.storage,version,space,ancestors,metadata.labels"): Promise<ConfluenceContent> {
    return this.http.get(`/content/${encodeURIComponent(id)}`, { expand });
  }

  findContent(input: { space?: string; title?: string; type?: string; limit?: number; expand?: string }): Promise<ConfluencePage<ConfluenceContent>> {
    return this.http.get("/content", {
      spaceKey: input.space,
      title: input.title,
      type: input.type ?? "page",
      limit: input.limit ?? 25,
      expand: input.expand ?? "space,version",
    });
  }

  async createContent(input: { space: string; title: string; body: string; representation: "wiki" | "storage"; parentId?: string }): Promise<ConfluenceContent> {
    return this.http.post("/content", {
      type: "page",
      title: input.title,
      space: { key: input.space },
      ancestors: input.parentId ? [{ id: input.parentId }] : undefined,
      body: { [input.representation]: { value: input.body, representation: input.representation } },
    });
  }

  async updateContent(input: { id: string; title: string; body: string; representation: "wiki" | "storage"; version: number; parentId?: string }): Promise<ConfluenceContent> {
    return this.http.put(`/content/${encodeURIComponent(input.id)}`, {
      id: input.id,
      type: "page",
      title: input.title,
      ancestors: input.parentId ? [{ id: input.parentId }] : undefined,
      version: { number: input.version },
      body: { [input.representation]: { value: input.body, representation: input.representation } },
    });
  }

  deleteContent(id: string): Promise<unknown> {
    return this.http.delete(`/content/${encodeURIComponent(id)}`);
  }

  getChildren(id: string, type?: string, expand = "space,version", limit = 25): Promise<ConfluencePage<ConfluenceContent>> {
    const suffix = type ? `/${encodeURIComponent(type)}` : "";
    return this.http.get(`/content/${encodeURIComponent(id)}/child${suffix}`, { expand, limit });
  }

  getComments(id: string, expand = "body.storage,version", limit = 25): Promise<ConfluencePage<ConfluenceContent>> {
    return this.http.get(`/content/${encodeURIComponent(id)}/child/comment`, { expand, limit });
  }

  addComment(input: { pageId: string; body: string; representation: "wiki" | "storage"; location?: "inline" | "footer" }): Promise<ConfluenceContent> {
    return this.http.post("/content", {
      type: "comment",
      container: { id: input.pageId, type: "page" },
      body: { [input.representation]: { value: input.body, representation: input.representation } },
      extensions: input.location ? { location: input.location } : undefined,
    });
  }

  async addInlineComment(input: {
    pageId: string;
    selection: string;
    body: string;
    representation: "wiki" | "storage";
  }): Promise<ConfluenceContent> {
    // 1. 先创建评论，拿到 comment ID（Server 版 marker.ac:ref = commentId）
    const comment = await this.addComment({
      pageId: input.pageId,
      body: input.body,
      representation: input.representation,
      location: "inline",
    });

    // 2. 拉取当前页面 storage body + version
    const page = await this.getContent(input.pageId, "body.storage,version,title");
    const storageBody = page.body?.storage?.value;
    if (!storageBody) throw new Error("Page has no storage-format body.");

    // 3. 在 storage 中定位选中文字并注入 marker（ref = commentId）
    const result = findAndAnnotateSelection(storageBody, input.selection, comment.id);
    if (!result) {
      // 回滚：删除刚创建的无关联评论
      await this.deleteContent(comment.id).catch(() => {});
      const preview = input.selection.slice(0, 80);
      throw new Error(`Selected text "${preview}${input.selection.length > 80 ? "..." : ""}" not found in page body. The text may span XML boundary, exist inside a macro, or differ from the storage format.`);
    }

    // 4. 更新页面 body（版本 +1），注入 marker
    const version = (page.version?.number ?? 0) + 1;
    await this.updateContent({
      id: input.pageId,
      title: page.title,
      body: result.annotatedBody,
      representation: "storage",
      version,
    });

    // 5. 设置评论的 Content Properties（标记为 inline comment）
    await this.setContentProperties(comment.id, [
      { key: "inline-comment", value: "true" },
      { key: "inline-marker-ref", value: comment.id },
      { key: "inline-original-selection", value: input.selection },
    ]);

    return comment;
  }

  async setContentProperty(contentId: string, key: string, value: unknown): Promise<unknown> {
    return this.http.post(`/content/${encodeURIComponent(contentId)}/property`, { key, value });
  }

  async setContentProperties(contentId: string, properties: Array<{ key: string; value: unknown }>): Promise<void> {
    for (const prop of properties) {
      await this.setContentProperty(contentId, prop.key, prop.value);
    }
  }

  getLabels(id: string, limit = 100): Promise<ConfluencePage<ConfluenceLabel>> {
    return this.http.get(`/content/${encodeURIComponent(id)}/label`, { limit });
  }

  addLabels(id: string, labels: string[]): Promise<ConfluencePage<ConfluenceLabel>> {
    return this.http.post(`/content/${encodeURIComponent(id)}/label`, labels.map((name) => ({ prefix: "global", name })));
  }

  deleteLabel(id: string, label: string): Promise<unknown> {
    return this.http.delete(`/content/${encodeURIComponent(id)}/label/${encodeURIComponent(label)}`);
  }

  listAttachments(id: string, limit = 100): Promise<ConfluencePage<ConfluenceAttachment>> {
    return this.http.get(`/content/${encodeURIComponent(id)}/child/attachment`, { limit, expand: "version,metadata" });
  }

  uploadAttachment(input: { pageId: string; filename: string; data: Buffer; comment?: string; minorEdit?: boolean; contentType?: string }): Promise<ConfluencePage<ConfluenceAttachment>> {
    return this.http.postMultipart(
      `/content/${encodeURIComponent(input.pageId)}/child/attachment`,
      { comment: input.comment, minorEdit: input.minorEdit },
      [{ fieldName: "file", filename: input.filename, data: input.data, contentType: input.contentType }],
    );
  }

  updateAttachmentData(input: { pageId: string; attachmentId: string; filename: string; data: Buffer; comment?: string; minorEdit?: boolean; contentType?: string }): Promise<ConfluencePage<ConfluenceAttachment>> {
    return this.http.postMultipart(
      `/content/${encodeURIComponent(input.pageId)}/child/attachment/${encodeURIComponent(input.attachmentId)}/data`,
      { comment: input.comment, minorEdit: input.minorEdit },
      [{ fieldName: "file", filename: input.filename, data: input.data, contentType: input.contentType }],
    );
  }

  downloadAttachment(downloadPath: string): Promise<{ data: Buffer; headers: Record<string, unknown> }> {
    return this.http.getBuffer(downloadPath);
  }

  /**
   * 流式下载附件到本地文件,避免大附件(~500MB)全量进内存。
   * 调用方负责确保 destPath 所在目录已存在。
   */
  async downloadAttachmentToFile(downloadPath: string, destPath: string): Promise<{ headers: Record<string, unknown> }> {
    return this.http.downloadToFile(downloadPath, destPath);
  }

  listSpaces(limit = 25): Promise<ConfluencePage<{ key: string; name: string }>> {
    return this.http.get("/space", { limit });
  }

  getSpace(spaceKey: string): Promise<{ key: string; name: string }> {
    return this.http.get(`/space/${encodeURIComponent(spaceKey)}`);
  }

  getCurrentUser(): Promise<unknown> {
    return this.http.get("/user/current");
  }

  convertBody(to: "storage" | "view" | "export_view" | "styled_view", body: unknown): Promise<unknown> {
    return this.http.post(`/contentbody/convert/${encodeURIComponent(to)}`, body);
  }

  request<T>(method: RestMethod, path: string, query?: Record<string, unknown>, body?: unknown): Promise<T> {
    return this.http.request<T>(method, path, query, body);
  }

  /**
   * 单次拿到页面的"焦点上下文":核心字段 + body 预览 + labels + 摘要 + 关键列表前 N 条。
   * 借鉴 zentao-cli `getBugSnapshot` / `getExecutionSnapshot` 的 focus + summary + highlights 三段式。
   * 5 个 REST 调用并行(`Promise.all`)。对 Agent 首轮探测页面非常友好。
   */
  async getPageSnapshot(input: {
    id: string;
    bodyPreviewChars?: number;
    commentLimit?: number;
    attachmentLimit?: number;
    childLimit?: number;
  }): Promise<PageSnapshot> {
    const bodyPreviewChars = input.bodyPreviewChars ?? 1500;
    const commentLimit = input.commentLimit ?? 5;
    const attachmentLimit = input.attachmentLimit ?? 10;
    const childLimit = input.childLimit ?? 10;

    const [page, labelsResult, comments, attachments, children] = await Promise.all([
      this.getContent(input.id, "body.storage,version,space,ancestors"),
      this.getLabels(input.id, 100),
      this.getComments(input.id, "version", commentLimit),
      this.listAttachments(input.id, attachmentLimit),
      this.getChildren(input.id, "page", "version", childLimit),
    ]);

    const storageBody = page.body?.storage?.value ?? "";

    return {
      pageId: page.id,
      focus: {
        id: page.id,
        title: page.title,
        type: page.type,
        spaceKey: page.space?.key,
        spaceName: page.space?.name,
        version: page.version?.number,
        updatedBy: page.version?.by?.displayName,
        updatedAt: page.version?.when,
        ancestors: page.ancestors,
      },
      text: {
        bodyPreview: storageBody.slice(0, bodyPreviewChars),
        bodyTruncated: storageBody.length > bodyPreviewChars,
        bodyLength: storageBody.length,
      },
      labels: labelsResult.results.map((label) => ({ prefix: label.prefix, name: label.name })),
      summary: {
        labelCount: labelsResult.size,
        commentCount: comments.size,
        attachmentCount: attachments.size,
        childPageCount: children.size,
      },
      comments: comments.results.map((comment) => ({
        id: comment.id,
        title: comment.title,
        version: comment.version?.number,
      })),
      attachments: attachments.results.map((attachment) => ({
        id: attachment.id,
        title: attachment.title,
        version: attachment.version?.number,
        mediaType: attachment.metadata?.mediaType,
      })),
      childPages: children.results.map((child) => ({
        id: child.id,
        title: child.title,
        type: child.type,
        version: child.version?.number,
      })),
    };
  }
}

export interface PageSnapshot {
  pageId: string;
  focus: {
    id: string;
    title: string;
    type: string;
    spaceKey?: string;
    spaceName?: string;
    version?: number;
    updatedBy?: string;
    updatedAt?: string;
    ancestors?: Array<{ id: string; title: string }>;
  };
  text: {
    bodyPreview: string;
    bodyTruncated: boolean;
    bodyLength: number;
  };
  labels: Array<{ prefix?: string; name: string }>;
  summary: {
    labelCount: number;
    commentCount: number;
    attachmentCount: number;
    childPageCount: number;
  };
  comments: Array<{ id: string; title: string; version?: number }>;
  attachments: Array<{ id: string; title: string; version?: number; mediaType?: string }>;
  childPages: Array<{ id: string; title: string; type: string; version?: number }>;
}
