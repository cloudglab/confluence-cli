import { z } from "zod";
import { getApi } from "../core/api-provider.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { previewOrAssertWriteAllowed } from "../core/write-guard.js";
import { jsonResult, listResult } from "../utils/result.js";

type ReportPeriod = "day" | "week" | "month" | "quarter" | "custom";
type ReportType = "page" | "blogpost" | "all";

const PERIOD_CQL: Record<"day" | "week" | "month", { from: string; to: string }> = {
  day: { from: "startOfDay()", to: "endOfDay()" },
  week: { from: "startOfWeek()", to: "endOfWeek()" },
  month: { from: "startOfMonth()", to: "endOfMonth()" },
};

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function quarterRange(now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3);
  const fromMonth = q * 3;
  // 季度首日 = y-MM-01; 季度末日 = 下季度首日的前一天
  const from = new Date(y, fromMonth, 1);
  const to = new Date(y, fromMonth + 3, 0);
  return { from: formatYmd(from), to: formatYmd(to) };
}

function escapeCqlString(value: string): string {
  return value.replace(/"/g, '\\"');
}

function buildReportCql(input: {
  period: ReportPeriod;
  type: ReportType;
  space?: string;
  creator?: string;
  from?: string;
  to?: string;
}): string {
  const fragments: string[] = [];

  // 内容类型
  if (input.type === "all") {
    fragments.push("type in (page, blogpost)");
  } else {
    fragments.push(`type = ${input.type}`);
  }

  // 空间限定
  if (input.space) fragments.push(`space = "${escapeCqlString(input.space)}"`);

  // 创建人
  if (input.creator) fragments.push(`creator = "${escapeCqlString(input.creator)}"`);

  // 周期
  if (input.period === "custom") {
    if (!input.from || !input.to) {
      throw new Error("--period custom 需要同时指定 --from 和 --to(YYYY-MM-DD)");
    }
    fragments.push(`created >= "${input.from}"`);
    fragments.push(`created <= "${input.to}"`);
  } else if (input.period === "quarter") {
    const r = quarterRange();
    fragments.push(`created >= "${r.from}"`);
    fragments.push(`created <= "${r.to}"`);
  } else {
    const r = PERIOD_CQL[input.period];
    fragments.push(`created >= ${r.from}`);
    fragments.push(`created <= ${r.to}`);
  }

  return `${fragments.join(" AND ")} ORDER BY created DESC`;
}

export function registerContentTools(registry: CliRegistry): void {
  registry.tool(
    "searchContent",
    { cql: z.string(), limit: z.number().int().positive().max(100).default(25) },
    async ({ cql, limit }) => {
      const effectiveLimit = limit ?? 25;
      const data = await getApi().search(cql, effectiveLimit);
      return jsonResult(
        listResult(data.results, {
          source: "rest",
          page: 1,
          limit: effectiveLimit,
          total: data.size,
          itemKey: "results",
        }),
      );
    },
    "Search Confluence content with CQL",
  );

  registry.tool(
    "getContent",
    { id: z.coerce.string(), expand: z.string().optional() },
    async ({ id, expand }) => {
      return jsonResult(await getApi().getContent(id, expand));
    },
    "Get one Confluence page/content by id",
  );

  registry.tool(
    "getPageSnapshot",
    {
      id: z.coerce.string(),
      bodyPreviewChars: z.number().int().positive().max(20000).default(1500)
        .describe("Max characters of body.storage to include in text.bodyPreview (default 1500)"),
      commentLimit: z.number().int().nonnegative().max(50).default(5)
        .describe("Max comments to include in highlights (default 5)"),
      attachmentLimit: z.number().int().nonnegative().max(50).default(10)
        .describe("Max attachments to include in highlights (default 10)"),
      childLimit: z.number().int().nonnegative().max(50).default(10)
        .describe("Max child pages to include in highlights (default 10)"),
    },
    async ({ id, bodyPreviewChars, commentLimit, attachmentLimit, childLimit }) => {
      return jsonResult(
        await getApi().getPageSnapshot({
          id,
          bodyPreviewChars: bodyPreviewChars ?? 1500,
          commentLimit: commentLimit ?? 5,
          attachmentLimit: attachmentLimit ?? 10,
          childLimit: childLimit ?? 10,
        }),
      );
    },
    "Get a single-call snapshot of a page (focus + body preview + labels + comments + attachments + child pages); 5 parallel REST requests, all cacheable",
  );

  registry.tool(
    "findContent",
    { space: z.string().optional(), title: z.string().optional(), type: z.string().default("page"), limit: z.number().int().positive().max(100).default(25), expand: z.string().optional() },
    async ({ space, title, type, limit, expand }) => {
      const effectiveLimit = limit ?? 25;
      const data = await getApi().findContent({ space, title, type, limit: effectiveLimit, expand });
      return jsonResult(
        listResult(data.results, {
          source: "rest",
          page: 1,
          limit: effectiveLimit,
          total: data.size,
          itemKey: "pages",
        }),
      );
    },
    "Find content by title, space or type",
  );

  registry.tool(
    "deleteContent",
    { id: z.coerce.string(), confirm: z.boolean().default(false) },
    async ({ id, confirm }) => {
      const preview = previewOrAssertWriteAllowed({ action: "deleteContent", confirm, payload: { id } });
      if (preview) return jsonResult(preview);
      return jsonResult(await getApi().deleteContent(id));
    },
    "Delete Confluence content; requires confirm=true",
  );

  registry.tool(
    "getPageChildren",
    { id: z.coerce.string(), type: z.string().optional(), expand: z.string().default("space,version"), limit: z.number().int().positive().max(100).default(25) },
    async ({ id, type, expand, limit }) => {
      return jsonResult(await getApi().getChildren(id, type, expand, limit));
    },
    "Get page children, optionally filtered by child type",
  );

  registry.tool(
    "getComments",
    { id: z.coerce.string(), expand: z.string().default("body.storage,version"), limit: z.number().int().positive().max(100).default(25) },
    async ({ id, expand, limit }) => {
      return jsonResult(await getApi().getComments(id, expand, limit));
    },
    "Get page comments",
  );

  registry.tool(
    "addComment",
    {
      id: z.coerce.string(),
      body: z.string(),
      inline: z.string().optional().describe("Selected text on the page to annotate (inline comment)"),
      representation: z.enum(["wiki", "storage"]).default("wiki"),
      confirm: z.boolean().default(false),
    },
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

  registry.tool(
    "report",
    {
      period: z.enum(["day", "week", "month", "quarter", "custom"]).default("day"),
      space: z.string().optional().describe("Restrict to a Confluence space key"),
      type: z.enum(["page", "blogpost", "all"]).default("all"),
      creator: z.string().optional().describe("Filter by content creator username"),
      from: z.string().optional().describe("Start date (YYYY-MM-DD), required when period=custom"),
      to: z.string().optional().describe("End date (YYYY-MM-DD), required when period=custom"),
      start: z.number().int().nonnegative().default(0).describe("Pagination start index"),
      limit: z.number().int().positive().max(250).default(25).describe("Page size (max 250)"),
      expand: z.string().optional().describe("Comma-separated expand fields for /content/search"),
    },
    async ({ period, space, type, creator, from, to, start, limit, expand }) => {
      const effectiveStart = start ?? 0;
      const effectiveLimit = limit ?? 25;
      const cql = buildReportCql({
        period: period ?? "day",
        type: type ?? "all",
        space,
        creator,
        from,
        to,
      });
      const data = await getApi().getReport({
        cql,
        start: effectiveStart,
        limit: effectiveLimit,
        expand,
      });
      return jsonResult(
        listResult(data.results, {
          source: "rest",
          page: Math.floor(effectiveStart / effectiveLimit) + 1,
          limit: effectiveLimit,
          total: data.size,
          itemKey: "results",
        }),
      );
    },
    "Generate a daily/weekly/monthly/quarterly report of Confluence content by created date (CQL time-range query)",
  );
}
