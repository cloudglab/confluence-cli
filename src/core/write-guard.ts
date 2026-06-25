export interface WriteGuardInput {
  action: string;
  confirm?: boolean;
  payload: unknown;
}

export interface WritePreview {
  ok: false;
  preview: true;
  reason: string;
  action: string;
  payload: unknown;
}

export interface UnsupportedWriteDiagnostic {
  ok: false;
  supported: false;
  error: string;
  action: string;
  diagnostic: string;
  payload: unknown;
}

/**
 * 不通过 CLI 暴露的写操作(action-level 拒绝)。
 *
 * key 格式: `<commandName>[:<subKind>]`。
 * - `callRestApi:<METHOD>` 拦截 REST 直通的高危 method(任何 path 都不允许)
 * - 其它键拦截具体业务动作(若未来加)
 *
 * 维护约定:
 * 1. 新增 command 时,如果动作不可逆/破坏性强/不该被 Agent 脚本化,加一行
 * 2. AGENTS.md 同步更新写保护章节
 * 3. 跑 `pnpm typecheck` + `pnpm build` + 命令 dry-run 验证
 */
const UNSUPPORTED_WRITE_ACTIONS: Record<string, string> = {
  "callRestApi:DELETE":
    "DELETE 操作不通过 CLI 暴露(高危:Confluence DELETE 多为不可逆)。请使用 Confluence UI、官方管理脚本或先 dry-run 列出受影响对象再走支持渠道。",
};

export function isWriteEnabled(): boolean {
  return process.env.CONFLUENCE_DISABLE_WRITE !== "true";
}

export function getWritePreview(input: WriteGuardInput, reason: string): WritePreview {
  return {
    ok: false,
    preview: true,
    reason,
    action: input.action,
    payload: input.payload,
  };
}

export function getUnsupportedWriteDiagnostic(input: WriteGuardInput, diagnostic: string): UnsupportedWriteDiagnostic {
  return {
    ok: false,
    supported: false,
    error: `写操作 ${input.action} 当前不能真实执行`,
    action: input.action,
    diagnostic,
    payload: input.payload,
  };
}

/**
 * 写操作硬校验:命中不支持动作 / 全局禁写 / 缺 confirm 任一即抛错。
 *
 * @internal 仅测试与外部脚本消费。CLI handler 走 {@link previewOrAssertWriteAllowed}
 * (返回诊断对象而非抛错,便于 Agent 拿到 payload 预览)。本函数保留导出是为了
 * inline import 单测能断言 throw 行为。不要在 handler 里直接调用。
 */
export function assertWriteAllowed(input: WriteGuardInput): void {
  const unsupportedReason = UNSUPPORTED_WRITE_ACTIONS[input.action];
  if (unsupportedReason) {
    throw new Error(`写操作 ${input.action} 当前不支持真实执行：${unsupportedReason}`);
  }

  if (!isWriteEnabled()) {
    throw new Error(`写操作已禁用。若要执行 ${input.action}，需要移除 CONFLUENCE_DISABLE_WRITE=true。`);
  }

  if (input.confirm !== true) {
    throw new Error(`写操作缺少确认。若要执行 ${input.action}，需要传入 confirm: true。`);
  }
}

export function previewOrAssertWriteAllowed(input: WriteGuardInput): WritePreview | UnsupportedWriteDiagnostic | null {
  const unsupportedReason = UNSUPPORTED_WRITE_ACTIONS[input.action];
  if (unsupportedReason) {
    return getUnsupportedWriteDiagnostic(input, unsupportedReason);
  }

  if (!isWriteEnabled()) {
    return getWritePreview(input, `写操作已禁用。若要执行 ${input.action}，需要移除 CONFLUENCE_DISABLE_WRITE=true。`);
  }

  if (input.confirm !== true) {
    return getWritePreview(input, `写操作缺少确认。若要执行 ${input.action}，需要传入 confirm: true。`);
  }

  return null;
}
