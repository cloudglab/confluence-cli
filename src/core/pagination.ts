export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_TOTAL_PAGES = 1000;

export function normalizePagination(input: PaginationInput = {}): PaginationParams {
  const pageCandidate = Number.isFinite(input.page) && input.page && input.page > 0 ? Math.floor(input.page) : DEFAULT_PAGE;
  const page = Math.max(pageCandidate, DEFAULT_PAGE);
  const rawLimitCandidate = Number.isFinite(input.limit) && input.limit && input.limit > 0 ? Math.floor(input.limit) : DEFAULT_LIMIT;
  const rawLimit = Math.max(rawLimitCandidate, 1);
  const limit = Math.min(rawLimit, MAX_LIMIT);

  return { page, limit };
}

export function normalizeTotalPages(total: unknown, limit: number, fallbackItemCount = 0): number {
  const parsedTotal = typeof total === "number" && Number.isFinite(total)
    ? total
    : typeof total === "string" && total.trim() !== ""
      ? Number(total)
      : fallbackItemCount;
  const safeTotal = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : fallbackItemCount;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
  return Math.min(Math.ceil(safeTotal / safeLimit), MAX_TOTAL_PAGES);
}

export async function fetchRemainingPagesConcurrently<T>(
  firstPage: { items: T[]; total?: unknown },
  fetchPage: (page: number) => Promise<T[]>,
  options: { limit?: number; concurrency?: number } = {},
): Promise<T[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const concurrency = options.concurrency ?? 3;
  const totalPages = normalizeTotalPages(firstPage.total, limit, firstPage.items.length);

  const allItems = [...firstPage.items];
  if (totalPages <= 1) return allItems;

  for (let startPage = 2; startPage <= totalPages; startPage += concurrency) {
    const endPage = Math.min(startPage + concurrency - 1, totalPages);
    const pageIndexes = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
    const pages = await Promise.all(pageIndexes.map((page) => fetchPage(page)));
    for (const items of pages) {
      allItems.push(...items);
    }
  }

  return allItems;
}

export interface FetchAllPagesOptions<T> {
  fetchPage: (page: number) => Promise<{ items: T[]; total?: unknown }>;
  pageSize?: number;
  concurrency?: number;
}

export async function fetchAllPages<T>(options: FetchAllPagesOptions<T>): Promise<T[]> {
  const pageSize = options.pageSize ?? 100;
  const firstPage = await options.fetchPage(1);
  return fetchRemainingPagesConcurrently(
    { items: firstPage.items, total: firstPage.total },
    async (page) => (await options.fetchPage(page)).items,
    { limit: pageSize, concurrency: options.concurrency },
  );
}
