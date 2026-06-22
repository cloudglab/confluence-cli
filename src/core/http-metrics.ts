/**
 * 模块级 HTTP 累计指标,对齐 zentao-cli 的 src/core/http-metrics.ts。
 *
 * 字段(每次 `record*` 调用更新,`snapshot()` 拷贝返回):
 * - requestCount: 累计发起的 HTTP 请求数(不含缓存命中,**含**重试)
 * - cacheHits   : GET 命中本地缓存的次数
 * - retries     : 触发的网络重试次数
 * - errors      : 失败的请求数(状态码非 2xx / 4xx / 5xx 之外的 throw,或 axios 网络层 throw)
 * - durationMs  : **上一次**请求的总耗时(毫秒,含重试),仅反映最近一次
 *
 * 这些是**进程级**累计;`resetMetrics()` 在 cli.ts 进入 handler 前调用,
 * 让 `meta.requestCount` 等字段反映"本次命令的请求情况",而不是整个进程的累计。
 */
export interface HttpMetricsSnapshot {
  requestCount: number;
  cacheHits: number;
  retries: number;
  errors: number;
  durationMs: number;
}

const state: HttpMetricsSnapshot = {
  requestCount: 0,
  cacheHits: 0,
  retries: 0,
  errors: 0,
  durationMs: 0,
};

export function recordRequest(durationMs: number, ok: boolean): void {
  state.requestCount += 1;
  state.durationMs = durationMs;
  if (!ok) state.errors += 1;
}

export function recordCacheHit(): void {
  state.cacheHits += 1;
}

export function recordRetry(): void {
  state.retries += 1;
}

export function snapshotMetrics(): HttpMetricsSnapshot {
  return { ...state };
}

export function resetMetrics(): void {
  state.requestCount = 0;
  state.cacheHits = 0;
  state.retries = 0;
  state.errors = 0;
  state.durationMs = 0;
}
