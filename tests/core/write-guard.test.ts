import { afterEach, describe, expect, it } from "vitest";
import {
  assertWriteAllowed,
  getUnsupportedWriteDiagnostic,
  getWritePreview,
  isWriteEnabled,
  previewOrAssertWriteAllowed,
} from "../../src/core/write-guard.js";

const ORIGINAL_DISABLE_WRITE_ENV = process.env.CONFLUENCE_DISABLE_WRITE;

function restoreWriteEnv(): void {
  if (ORIGINAL_DISABLE_WRITE_ENV === undefined) delete process.env.CONFLUENCE_DISABLE_WRITE;
  else process.env.CONFLUENCE_DISABLE_WRITE = ORIGINAL_DISABLE_WRITE_ENV;
}

afterEach(() => {
  restoreWriteEnv();
});

describe("write-guard", () => {
  it("默认开启，仅在显式禁用时关闭", () => {
    delete process.env.CONFLUENCE_DISABLE_WRITE;
    expect(isWriteEnabled()).toBe(true);

    process.env.CONFLUENCE_DISABLE_WRITE = "false";
    expect(isWriteEnabled()).toBe(true);

    process.env.CONFLUENCE_DISABLE_WRITE = "true";
    expect(isWriteEnabled()).toBe(false);
  });

  it("返回预览信息", () => {
    expect(getWritePreview({ action: "uploadMarkdown", payload: { id: 1 } }, "disabled")).toEqual({
      ok: false,
      preview: true,
      reason: "disabled",
      action: "uploadMarkdown",
      payload: { id: 1 },
    });
  });

  it("返回不支持诊断", () => {
    expect(getUnsupportedWriteDiagnostic({ action: "write", payload: { id: 2 } }, "not supported")).toEqual({
      ok: false,
      supported: false,
      error: "写操作 write 当前不能真实执行",
      action: "write",
      diagnostic: "not supported",
      payload: { id: 2 },
    });
  });

  it("校验显式禁用和确认", () => {
    process.env.CONFLUENCE_DISABLE_WRITE = "true";
    expect(() => assertWriteAllowed({ action: "uploadMarkdown", confirm: true, payload: {} })).toThrow(
      "写操作已禁用。若要执行 uploadMarkdown，需要移除 CONFLUENCE_DISABLE_WRITE=true。",
    );

    delete process.env.CONFLUENCE_DISABLE_WRITE;
    expect(() => assertWriteAllowed({ action: "uploadMarkdown", payload: {} })).toThrow(
      "写操作缺少确认。若要执行 uploadMarkdown，需要传入 confirm: true。",
    );
  });

  it("允许时返回 null", () => {
    delete process.env.CONFLUENCE_DISABLE_WRITE;
    expect(previewOrAssertWriteAllowed({ action: "uploadMarkdown", confirm: true, payload: { id: 4 } })).toBeNull();
  });
});
