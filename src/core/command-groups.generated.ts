// 由 scripts/generate-manifest.ts 在 build 时自动生成，请勿手动编辑。

export const commandToGroup: Record<string, string> = {
  "initConfluence": "init",
  "install": "install",
  "remove": "install",
  "uninstall": "install",
  "update": "install",
  "convertMarkdownToWiki": "convert",
  "convertMermaidToDrawio": "convert",
  "generateMarkMetadata": "metadata",
  "callRestApi": "rest",
  "listRestApis": "rest",
  "convertContentBody": "space",
  "getCurrentUser": "space",
  "getSpace": "space",
  "listSpaces": "space",
  "who-am-i": "space",
  "whoami": "space",
  "addComment": "content",
  "deleteContent": "content",
  "findContent": "content",
  "getComments": "content",
  "getContent": "content",
  "getPageChildren": "content",
  "getPageSnapshot": "content",
  "report": "content",
  "searchContent": "content",
  "addLabels": "labels",
  "deleteLabel": "labels",
  "getLabels": "labels",
  "downloadAttachment": "attachments",
  "listAttachments": "attachments",
  "updateAttachment": "attachments",
  "uploadAttachment": "attachments",
  "downloadPage": "transfer",
  "uploadHtml": "transfer",
  "uploadMarkdown": "transfer"
};

export const groupCommands: Record<string, string[]> = {
  "init": [
    "initConfluence"
  ],
  "install": [
    "install",
    "remove",
    "uninstall",
    "update"
  ],
  "convert": [
    "convertMarkdownToWiki",
    "convertMermaidToDrawio"
  ],
  "metadata": [
    "generateMarkMetadata"
  ],
  "rest": [
    "callRestApi",
    "listRestApis"
  ],
  "space": [
    "convertContentBody",
    "getCurrentUser",
    "getSpace",
    "listSpaces",
    "who-am-i",
    "whoami"
  ],
  "content": [
    "addComment",
    "deleteContent",
    "findContent",
    "getComments",
    "getContent",
    "getPageChildren",
    "getPageSnapshot",
    "report",
    "searchContent"
  ],
  "labels": [
    "addLabels",
    "deleteLabel",
    "getLabels"
  ],
  "attachments": [
    "downloadAttachment",
    "listAttachments",
    "updateAttachment",
    "uploadAttachment"
  ],
  "transfer": [
    "downloadPage",
    "uploadHtml",
    "uploadMarkdown"
  ]
};
