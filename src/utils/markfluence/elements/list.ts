import type { List, ListItem, Parent } from "mdast";
import { registerConverter } from "../registry.js";
import type { ConversionContext } from "../types.js";

registerConverter<List>("list", (node, context, convertChildren) => {
  const isTaskList = node.children.some((item: ListItem) => item.type === "listItem" && typeof item.checked === "boolean");
  if (isTaskList) return renderTaskList(node, context, convertChildren);

  const tag = node.ordered ? "ol" : "ul";
  return `<${tag}>${convertChildren(node)}</${tag}>`;
});

registerConverter<ListItem>("listItem", (node, _context, convertChildren) => `<li>${convertChildren(node)}</li>`);

function renderTaskList(node: List, _context: ConversionContext, convertChildren: (node: Parent) => string): string {
  const items = node.children
    .filter((item): item is ListItem => item.type === "listItem")
    .map((item: ListItem) => {
      const checked = item.checked === true;
      const content = convertChildren(item);
      const cleanContent = content.replace(/^<p>(.*)<\/p>$/s, "$1");
      return `<ac:task><ac:task-status>${checked ? "complete" : "incomplete"}</ac:task-status><ac:task-body>${cleanContent}</ac:task-body></ac:task>`;
    })
    .join("");

  return `<ac:task-list>${items}</ac:task-list>`;
}
