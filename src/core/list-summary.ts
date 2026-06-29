export interface ListSummaryItem {
  id: number | string;
  name?: string;
  sortKey?: string;
  status?: string;
}

export interface ListSummary {
  total: number;
  byStatus: Record<string, number>;
  top: ListSummaryItem[];
  highlight: string;
  byGroup?: Record<string, number>;
  groupKey?: string;
}

export function summarizeList<
  T extends {
    id: number | string;
    name?: string;
    status?: string;
    deadline?: string;
    updatedAt?: string;
    createdAt?: string;
    productName?: string | number;
    projectName?: string | number;
    product?: string | number;
    project?: string | number;
  },
>(items: T[], options: { sortKey?: 'deadline' | 'updatedAt' | 'createdAt'; groupKey?: string; topN?: number } = {}): ListSummary {
  const sortKey = options.sortKey ?? 'updatedAt';
  const topN = options.topN ?? 3;
  const groupKey = options.groupKey;
  const byStatus: Record<string, number> = {};
  const byGroup: Record<string, number> = {};

  for (const item of items) {
    const s = item.status ?? 'unknown';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    if (groupKey) {
      const v = (item as Record<string, unknown>)[groupKey];
      const s2 = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
      if (s2) byGroup[s2] = (byGroup[s2] ?? 0) + 1;
    }
  }

  const sortCandidates = items
    .map((item) => ({ item, sortValue: (item as Record<string, unknown>)[sortKey] as string | undefined }))
    .filter((entry) => typeof entry.sortValue === 'string' && entry.sortValue !== '')
    .sort((left, right) => left.sortValue!.localeCompare(right.sortValue!));

  const top: ListSummaryItem[] = sortCandidates.slice(0, topN).map(({ item, sortValue }) => ({
    id: item.id, name: item.name, status: item.status, sortKey: sortValue,
  }));

  const highlight = items.length === 0
    ? '当前无数据。'
    : `共 ${items.length} 条${groupKey ? `（按 ${groupKey} 分布）` : ''}。`;

  const summary: ListSummary = { total: items.length, byStatus, top, highlight };
  if (groupKey && Object.keys(byGroup).length > 0) { summary.byGroup = byGroup; summary.groupKey = groupKey; }
  return summary;
}
