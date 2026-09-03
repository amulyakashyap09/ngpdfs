import { parseDocument } from "htmlparser2";
import type { CompatibilityReport, DocumentBlock, InlineRun, PortableDocument, TableCell, TextAlignment } from "./types";
import { collapseWhitespace, decodeDataImage, mergeRuns, parseAlignment, parseCssColor, safeHref } from "./utils";

interface HtmlNode {
  type: string;
  data?: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: HtmlNode[];
}

interface HtmlParseState {
  report: CompatibilityReport;
  omitted: Set<string>;
}

const BLOCK_CONTAINERS = new Set(["html", "body", "main", "article", "section", "div", "header", "footer", "nav", "figure", "figcaption"]);
const BLOCKED_ELEMENTS = new Set(["script", "iframe", "object", "embed", "form", "input", "button", "video", "audio", "canvas", "svg"]);

export function parseHtml(source: string, title?: string, format: "html" | "rich-text" = "html"): { document: PortableDocument; report: CompatibilityReport } {
  const report: CompatibilityReport = {
    format,
    preserved: ["headings", "paragraphs", "emphasis", "lists", "tables", "links", "inline colors", "page breaks", "embedded data images"],
    approximated: ["CSS layout", "link annotations"],
    omitted: [],
    warnings: [],
  };
  const state: HtmlParseState = { report, omitted: new Set() };
  const root = parseDocument(source, { decodeEntities: true }) as unknown as HtmlNode;
  const blocks: DocumentBlock[] = [];
  appendBlocks(root.children ?? [], blocks, state);
  report.omitted = [...state.omitted];
  if (state.omitted.has("scripts and active content")) report.warnings.push("Scripts, event handlers, frames, forms, and other active content were removed without execution.");
  if (state.omitted.has("external images")) report.warnings.push("External images were blocked. Use embedded PNG/JPEG data images or an imported package.");
  if (/<(?:link|style)\b/i.test(source)) report.warnings.push("Stylesheets are not executed; only a safe subset of inline typography and page-break CSS is interpreted.");
  return { document: { title: title || documentTitle(root), blocks }, report };
}

function appendBlocks(nodes: HtmlNode[], blocks: DocumentBlock[], state: HtmlParseState): void {
  let looseRuns: InlineRun[] = [];
  const flushLoose = () => {
    const text = collapseWhitespace(looseRuns.map((run) => run.text).join(""));
    if (text) blocks.push({ kind: "paragraph", runs: [{ text }] });
    looseRuns = [];
  };
  for (const node of nodes) {
    if (node.type === "text") {
      looseRuns.push({ text: node.data ?? "" });
      continue;
    }
    if (!isElement(node)) continue;
    const name = node.name!;
    if (name === "head" || name === "title" || name === "meta" || name === "link" || name === "style") continue;
    if (BLOCKED_ELEMENTS.has(name)) {
      flushLoose();
      state.omitted.add("scripts and active content");
      continue;
    }
    const style = parseStyle(node.attribs?.style);
    if (style.breakBefore) {
      flushLoose();
      blocks.push({ kind: "page-break" });
    }
    if (/^h[1-6]$/.test(name)) {
      flushLoose();
      blocks.push({ kind: "heading", level: Number(name[1]) as 1 | 2 | 3 | 4 | 5 | 6, runs: inlineRuns(node.children ?? [], {}, state), align: style.align });
    } else if (name === "p" || name === "address") {
      flushLoose();
      const runs = inlineRuns(node.children ?? [], {}, state);
      if (runs.some((run) => run.text.trim())) blocks.push({ kind: "paragraph", runs, align: style.align });
    } else if (name === "ul" || name === "ol") {
      flushLoose();
      const items = (node.children ?? []).filter((child) => isElement(child) && child.name === "li").map((item) => inlineRuns(item.children ?? [], {}, state));
      if (items.length) blocks.push({ kind: "list", ordered: name === "ol", start: Number(node.attribs?.start) || undefined, items });
    } else if (name === "pre") {
      flushLoose();
      blocks.push({ kind: "code", text: rawText(node) });
    } else if (name === "blockquote") {
      flushLoose();
      blocks.push({ kind: "quote", runs: inlineRuns(node.children ?? [], {}, state) });
    } else if (name === "table") {
      flushLoose();
      const table = tableBlock(node, state);
      if (table) blocks.push(table);
    } else if (name === "hr") {
      flushLoose();
      blocks.push({ kind: "rule" });
    } else if (name === "img") {
      flushLoose();
      const image = decodeDataImage(node.attribs?.src ?? "");
      if (image) blocks.push({ kind: "image", ...image, alt: node.attribs?.alt });
      else state.omitted.add("external images");
    } else if (BLOCK_CONTAINERS.has(name)) {
      flushLoose();
      appendBlocks(node.children ?? [], blocks, state);
    } else {
      looseRuns.push(...inlineRuns([node], {}, state));
    }
    if (style.breakAfter) {
      flushLoose();
      blocks.push({ kind: "page-break" });
    }
  }
  flushLoose();
}

function inlineRuns(nodes: HtmlNode[], inherited: Omit<InlineRun, "text">, state: HtmlParseState): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      runs.push({ text: node.data ?? "", ...inherited });
      continue;
    }
    if (!isElement(node)) continue;
    const name = node.name!;
    if (BLOCKED_ELEMENTS.has(name) || name === "style") {
      state.omitted.add("scripts and active content");
      continue;
    }
    if (name === "br") {
      runs.push({ text: "\n", ...inherited });
      continue;
    }
    if (name === "img") {
      const alt = collapseWhitespace(node.attribs?.alt ?? "");
      runs.push({ text: alt ? `[Image: ${alt}]` : "[Image]", ...inherited, italic: true });
      if (!decodeDataImage(node.attribs?.src ?? "")) state.omitted.add("external images");
      continue;
    }
    const style = parseStyle(node.attribs?.style);
    const next: Omit<InlineRun, "text"> = {
      ...inherited,
      bold: inherited.bold || name === "strong" || name === "b" || style.bold,
      italic: inherited.italic || name === "em" || name === "i" || style.italic,
      underline: inherited.underline || name === "u" || style.underline,
      code: inherited.code || name === "code" || name === "kbd" || name === "samp",
      color: style.color ?? inherited.color,
      href: name === "a" ? safeHref(node.attribs?.href) : inherited.href,
    };
    if (name === "a") {
      next.underline = true;
      next.color = [0.1, 0.3, 0.75];
    }
    runs.push(...inlineRuns(node.children ?? [], next, state));
  }
  return mergeRuns(runs);
}

function tableBlock(node: HtmlNode, state: HtmlParseState): Extract<DocumentBlock, { kind: "table" }> | null {
  const rowNodes = descendants(node, "tr");
  const rows = rowNodes.map((row) => (row.children ?? [])
    .filter((cell) => isElement(cell) && (cell.name === "td" || cell.name === "th"))
    .map<TableCell>((cell) => ({
      runs: inlineRuns(cell.children ?? [], cell.name === "th" ? { bold: true } : {}, state),
      align: parseStyle(cell.attribs?.style).align ?? parseAlignment(cell.attribs?.align),
    })))
    .filter((row) => row.length > 0);
  if (!rows.length) return null;
  const firstRowNode = rowNodes[0];
  const headerRows = firstRowNode?.children?.some((cell) => isElement(cell) && cell.name === "th") ? 1 : 0;
  return { kind: "table", rows, headerRows, striped: true };
}

function descendants(node: HtmlNode, name: string): HtmlNode[] {
  const found: HtmlNode[] = [];
  for (const child of node.children ?? []) {
    if (!isElement(child)) continue;
    if (child.name === name) found.push(child);
    else found.push(...descendants(child, name));
  }
  return found;
}

function rawText(node: HtmlNode): string {
  if (node.type === "text") return node.data ?? "";
  return (node.children ?? []).map(rawText).join("");
}

function documentTitle(root: HtmlNode): string | undefined {
  const title = descendants(root, "title")[0];
  return title ? collapseWhitespace(rawText(title)) : undefined;
}

function isElement(node: HtmlNode): boolean {
  return (node.type === "tag" || node.type === "script" || node.type === "style") && typeof node.name === "string";
}

function parseStyle(value: string | undefined): {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: [number, number, number];
  align?: TextAlignment;
  breakBefore?: boolean;
  breakAfter?: boolean;
} {
  const entries: Array<[string, string]> = (value ?? "").split(";").map((part): [string, string] => {
    const colon = part.indexOf(":");
    return colon < 0 ? ["", ""] : [part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim().toLowerCase()];
  }).filter(([key]) => Boolean(key));
  const declarations = new Map<string, string>(entries);
  return {
    bold: /^(bold|[6-9]00)$/.test(declarations.get("font-weight") ?? ""),
    italic: declarations.get("font-style") === "italic",
    underline: (declarations.get("text-decoration") ?? "").includes("underline"),
    color: parseCssColor(declarations.get("color")),
    align: parseAlignment(declarations.get("text-align")),
    breakBefore: ["always", "page"].includes(declarations.get("page-break-before") ?? declarations.get("break-before") ?? ""),
    breakAfter: ["always", "page"].includes(declarations.get("page-break-after") ?? declarations.get("break-after") ?? ""),
  };
}
