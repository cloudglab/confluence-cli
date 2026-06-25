import type { Parent, Table, TableCell, TableRow } from "mdast";
import { registerConverter } from "../registry.js";

registerConverter<Table>("table", (node, _context, convertChildren) => {
  const align = node.align || [];
  const rows = node.children;
  if (rows.length === 0) return "";

  const headerRow = rows[0];
  const bodyRows = rows.slice(1);
  const headerCells = headerRow.children.map((cell: TableCell, index: number) => {
    const content = convertChildren(cell as Parent);
    const style = getAlignStyle(align[index]);
    return style ? `<th style="${style}">${content}</th>` : `<th>${content}</th>`;
  }).join("");

  const header = `<thead><tr>${headerCells}</tr></thead>`;
  const body = bodyRows.length > 0
    ? `<tbody>${bodyRows.map((row: TableRow) => `<tr>${row.children.map((cell: TableCell, index: number) => {
      const content = convertChildren(cell as Parent);
      const style = getAlignStyle(align[index]);
      return style ? `<td style="${style}">${content}</td>` : `<td>${content}</td>`;
    }).join("")}</tr>`).join("")}</tbody>`
    : "";

  return `<table>${header}${body}</table>`;
});

function getAlignStyle(align: string | null | undefined): string | null {
  if (!align) return null;
  return `text-align: ${align}`;
}
