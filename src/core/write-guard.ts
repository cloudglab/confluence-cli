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

const UNSUPPORTED_WRITE_ACTIONS: Record<string, string> = {};

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
