/**
 * 把任意字符串规整成安全文件名:替换路径分隔符 / 非法字符,剥掉首尾点号和控制字符。
 *
 * 跨工具复用(transfer.ts / attachments.ts),避免两处各写一份导致行为漂移。
 * - 替换 Windows / POSIX 保留字符:`\\ / : * ? " < > |`
 * - 剥掉首部点号:防止 `.DS_Store` 这类名字被当成隐藏文件 / 上层目录穿越
 * - 控制字符(`\x00-\x1f`)替换成 `_`,避免在文件系统 / Confluence 附件名里出现不可见字符
 */
export function safeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/^\.+/, "")
    .replace(/[\x00-\x1f]/g, "_");
}
