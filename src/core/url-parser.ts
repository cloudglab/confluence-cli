/**
 * Confluence 网页 URL → 结构化意图解析。
 *
 * 不调用任何 REST API，纯字符串/路径匹配。
 * 设计目标:Agent 拿到用户粘贴的 Confluence URL 时,立刻能识别:
 *   - 目标类型(页面/空间/附件/草稿/评论/历史/搜索/仪表板/API)
 *   - 业务语义化参数(pageId / spaceKey / filename / queryString / ...)
 *   - 主命令 + 候选命令 + 备注(给 Agent 决策用)
 *   - 主机是否匹配(主机不匹配仍解析,但标 matchedServer=false,提醒走 callRestApi 直通)
 *
 * 路由匹配规则见 matchRoute()。新增 URL 模式时,在 ROUTE_KIND_HINT 加一行即可。
 */

import { loadConfluenceConfig } from "./config.js";

export interface ParsedUrl {
  /** 解析后的原 URL(已 trim) */
  originalUrl: string;
  /** URL 拆解 */
  parsed: {
    host: string;
    pathname: string;
    search: string;
    hash: string;
  };
  /** URL 主机是否与 expectedHost 匹配(同 host 同 port 同 protocol) */
  matchedServer: boolean;
  /** 路由种类:page | space | attachment | edit | comment | history | search | dashboard | api | unknown */
  routeKind: string;
  /** 业务语义化参数(已转 number 的整数键) */
  params: Record<string, string | number>;
  /** 最匹配的命令(可能为空) */
  primaryCommand?: string;
  /** 候选命令列表(主命令 + 1-3 备选 + 说明) */
  suggestedCommands: string[];
  /** 备注/解释 */
  note?: string;
}

export interface ParseOptions {
  /** 期望的 host(host:port,无协议)。默认从 process.env.CONFLUENCE_URL 推导。 */
  expectedHost?: string;
  /** 强制要求 matchedServer=true,否则抛错 */
  requireMatchedServer?: boolean;
}

const ROUTE_KIND_HINT: Record<string, { primary?: string; suggested: string[]; note?: string }> = {
  page: {
    primary: "getContent",
    suggested: ["getPageSnapshot", "getPageChildren", "getComments", "listAttachments", "getLabels"],
    note: "已识别为页面 URL,主命令 getContent 拉正文;getPageSnapshot 一次拿完整画像(评论/附件/标签/子页)。",
  },
  space: {
    primary: "getSpace",
    suggested: ["listSpaces", "searchContent"],
    note: "已识别为空间 URL,主命令 getSpace 拉空间元信息。",
  },
  attachment: {
    primary: "downloadAttachment",
    suggested: ["listAttachments"],
    note: "已识别为附件下载 URL,downloadAttachment 拉文件;listAttachments 列本页所有附件。",
  },
  edit: {
    primary: "getContent",
    suggested: ["uploadMarkdown", "uploadHtml"],
    note: "已识别为草稿编辑页,getContent 拿当前正文(只读);改写请用 uploadMarkdown/uploadHtml(需 --confirm true)。",
  },
  comment: {
    primary: "getComments",
    suggested: ["getContent", "addComment"],
    note: "已识别为页面评论锚点,getComments 列本页评论(commentId 仅锚点用,API 无独立读路径)。",
  },
  history: {
    primary: "getContent",
    suggested: ["searchContent"],
    note: "已识别为历史版本页,getContent --expand version 拿版本元信息。",
  },
  search: {
    primary: "searchContent",
    suggested: ["report", "findContent"],
    note: "已识别为搜索 URL,searchContent 走 CQL(queryString 转 text ~ 查询);report 走预定义周期。",
  },
  dashboard: {
    primary: "listSpaces",
    suggested: ["searchContent", "report"],
    note: "仪表板无直连命令,候选:列空间 / 全局搜索 / 日报。",
  },
  api: {
    primary: "callRestApi",
    suggested: ["listRestApis"],
    note: "REST API 端点,callRestApi 直通(注意 method 与确认);DELETE 被 UNSUPPORTED_WRITE_ACTIONS 拦截。",
  },
  unknown: {
    suggested: ["searchContent", "listSpaces", "listRestApis"],
    note: "URL 模式未能匹配,候选:全局搜索、列空间、REST API 直通。",
  },
};

export function parseConfluenceUrl(input: string, options: ParseOptions = {}): ParsedUrl {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL 不能为空。");

  const expectedHost = options.expectedHost ?? defaultExpectedHost();

  const url = tryParseUrl(trimmed);
  if (!url) throw new Error(`无法解析为 URL: ${input}`);

  const matchedServer = expectedHost ? sameHost(url, expectedHost) : false;
  if (options.requireMatchedServer && !matchedServer) {
    throw new Error(
      `URL 主机 ${url.host} 与期望 ${expectedHost} 不一致(可省略该检查或传 expectedHost 强制解析)。`,
    );
  }

  const { routeKind, params, note: routeNote } = matchRoute(url);
  const hint = ROUTE_KIND_HINT[routeKind] ?? ROUTE_KIND_HINT.unknown;

  return {
    originalUrl: trimmed,
    parsed: {
      host: url.host,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    },
    matchedServer,
    routeKind,
    params,
    primaryCommand: hint.primary,
    suggestedCommands: hint.suggested,
    note: routeNote ?? (matchedServer ? hint.note : appendServerMismatchNote(hint.note)),
  };
}

/** 简易 URL 检测:首段是 https?://,或像 atlassian.net / confluence. 域名 */
export function looksLikeUrl(token: string): boolean {
  if (!token) return false;
  const trimmed = token.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  // 兜底:含典型 Confluence 域名或 path 前缀
  return /^(?:[\w-]+\.)+(?:atlassian\.net|confluence\.[\w-]+|cloudglab\.cn)\b/i.test(trimmed);
}

function defaultExpectedHost(): string | undefined {
  // 1) 优先:env 显式 CONFLUENCE_URL
  const env = process.env.CONFLUENCE_URL;
  if (env) {
    try {
      return new URL(env).host;
    } catch {
      // fall through
    }
  }
  // 2) fallback:从 ~/.confluence/config.json(或 env 组合)推断,加载失败(凭证缺失等)静默
  try {
    const config = loadConfluenceConfig();
    return new URL(config.url).host;
  } catch {
    return undefined;
  }
}

function tryParseUrl(trimmed: string): URL | undefined {
  try {
    return new URL(trimmed);
  } catch {
    // 尝试补 https:// 前缀
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return undefined;
    }
  }
}

function sameHost(url: URL, expected: string): boolean {
  return url.host === expected;
}

function appendServerMismatchNote(note: string | undefined): string {
  const prefix = "主机不匹配(标 matchedServer=false,主命令仍可试,但跨域可能受限)。";
  return note ? `${prefix} ${note}` : prefix;
}

function matchRoute(url: URL): { routeKind: string; params: Record<string, string | number>; note?: string } {
  const rawPath = url.pathname.replace(/\/+$/, "") || "/";
  const path = stripBasePath(rawPath);
  const pageIdRaw = url.searchParams.get("pageId");
  const pageId = pageIdRaw && /^\d+$/.test(pageIdRaw) ? pageIdRaw : undefined;
  const hash = url.hash;
  const commentMatch = hash.match(/^#comment-(\d+)$/);
  const focusedCommentRaw = url.searchParams.get("focusedCommentId");
  const focusedCommentId = focusedCommentRaw && /^\d+$/.test(focusedCommentRaw) ? focusedCommentRaw : undefined;

  // 1. /x/{shortcode} — Confluence Cloud tiny link(短链),无短码表无法解析
  const tinyLinkMatch = path.match(/^\/x\/([A-Za-z0-9_-]+)$/);
  if (tinyLinkMatch) {
    return {
      routeKind: "unknown",
      params: { shortCode: tinyLinkMatch[1] },
      note: "Tiny link 短链(Confluence Cloud 私有编码),需 HEAD 解码或服务端解析;候选:searchContent 按标题找页面。",
    };
  }

  // 2. /spaces/{key}/pages/{id}/{title?} — Cloud 7.x 新格式
  const cloudPageMatch = path.match(/^\/spaces\/([A-Z0-9]+)\/pages\/(\d+)(?:\/(.+))?$/);
  if (cloudPageMatch) {
    return {
      routeKind: "page",
      params: { spaceKey: cloudPageMatch[1], pageId: cloudPageMatch[2], slug: cloudPageMatch[3] },
      note: "Cloud 新版链接,pageId 居中可直接用。",
    };
  }

  // 3. /spaces/{key}/folder/{id} — Cloud folder 资源
  const folderMatch = path.match(/^\/spaces\/([A-Z0-9]+)\/folder\/(\d+)$/);
  if (folderMatch) {
    return {
      routeKind: "page",
      params: { spaceKey: folderMatch[1], folderId: folderMatch[2], isFolder: 1 },
      note: "Cloud folder 资源,无直连命令;候选:searchContent 按 spaceKey 找子页。",
    };
  }

  // 4. /spaces/{key}/{slug}-{id} — 7.x 旧版 slug-id 链接
  const newSpacePageMatch = path.match(/^\/spaces\/([A-Z0-9]+)\/(.+?)-(\d+)$/);
  if (newSpacePageMatch) {
    return {
      routeKind: "page",
      params: { spaceKey: newSpacePageMatch[1], slug: newSpacePageMatch[2], pageId: newSpacePageMatch[3] },
      note: "从旧版链接 slug-末尾提取 pageId,主命令 getContent 直接用 pageId。",
    };
  }

  // 5. /spaces/{key}/overview 或 /spaces/{key} — 空间主页
  const spaceOverviewMatch = path.match(/^\/spaces\/([A-Z0-9]+)(?:\/overview)?$/);
  if (spaceOverviewMatch) {
    return { routeKind: "space", params: { spaceKey: spaceOverviewMatch[1] } };
  }

  // 6. /display/{key}/{slug} 或 /display/{key}
  const displayMatch = path.match(/^\/display\/([A-Z0-9]+)(?:\/(.+))?$/);
  if (displayMatch) {
    if (displayMatch[2]) {
      return { routeKind: "page", params: { spaceKey: displayMatch[1], slug: displayMatch[2] } };
    }
    return { routeKind: "space", params: { spaceKey: displayMatch[1] } };
  }

  // 7. /pages/viewpage.action?pageId= 主流 page by id(hash / focusedCommentId 都归 comment)
  if (path === "/pages/viewpage.action") {
    if (commentMatch) {
      const params: Record<string, string | number> = {};
      if (pageId) params.pageId = pageId;
      params.commentId = commentMatch[1];
      return { routeKind: "comment", params, note: "页面评论锚点,getComments 拿本页所有评论(暂不支持按 commentId 单读)。" };
    }
    if (focusedCommentId) {
      const params: Record<string, string | number> = {};
      if (pageId) params.pageId = pageId;
      params.commentId = focusedCommentId;
      return { routeKind: "comment", params, note: "Cloud focusedCommentId 查询参数,等同 hash 锚点。getComments 拿本页评论。" };
    }
    if (pageId) {
      return { routeKind: "page", params: { pageId } };
    }
    return { routeKind: "unknown", params: { path: rawPath } };
  }

  // 8. /pages/editpage.action?pageId=
  if (path === "/pages/editpage.action") {
    if (pageId) return { routeKind: "edit", params: { pageId } };
    return { routeKind: "unknown", params: { path: rawPath } };
  }

  // 9. /pages/viewpreviousversions.action?pageId=
  if (path === "/pages/viewpreviousversions.action") {
    if (pageId) return { routeKind: "history", params: { pageId } };
    return { routeKind: "unknown", params: { path: rawPath } };
  }

  // 10. /search?queryString= (Confluence 7.x)
  if (path === "/search" || path === "/dosearchsite.action") {
    const query = url.searchParams.get("queryString") ?? url.searchParams.get("query");
    if (query) {
      return { routeKind: "search", params: { queryString: query } };
    }
  }

  // 11. /download/attachments/{pageId}/{filename}
  const attachmentMatch = path.match(/^\/download\/attachments\/(\d+)\/([^/]+)$/);
  if (attachmentMatch) {
    const pageId = attachmentMatch[1];
    const filename = safeDecode(attachmentMatch[2]);
    const version = url.searchParams.get("version");
    const params: Record<string, string | number> = { pageId, filename };
    if (version) params.version = version;
    return { routeKind: "attachment", params };
  }

  // 12. /rest/api/... → api 直通
  if (path.startsWith("/rest/api/")) {
    return {
      routeKind: "api",
      params: { restPath: path.replace(/^\/rest\/api\/?/, ""), method: "GET" },
    };
  }

  // 13. /dashboard 或 /dashboard.action
  if (path === "/dashboard.action" || path === "/dashboard" || path === "/") {
    return { routeKind: "dashboard", params: {} };
  }

  return { routeKind: "unknown", params: { path: rawPath } };
}

/** 剥除 /wiki 或 /confluence base path(Confluence 7.x 部署常带前缀) */
function stripBasePath(pathname: string): string {
  for (const base of ["/wiki", "/confluence"]) {
    if (pathname === base) return "/";
    if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  }
  return pathname;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
