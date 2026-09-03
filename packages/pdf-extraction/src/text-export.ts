import type { AnalyzedPdf, AnalyzedPage, LayoutBlock } from "./types";

export function pageReadingText(page: AnalyzedPage): string {
  return page.blocks.map((block) => blockText(block, page)).filter(Boolean).join("\n\n");
}

export function buildLayoutPlainText(document: AnalyzedPdf): string {
  return document.pages.map((page) => `--- Page ${page.pageNumber} ---\n\n${pageReadingText(page)}`).join("\n\n\n").concat("\n");
}

export function buildLayoutMarkdown(document: AnalyzedPdf): string {
  const pages = document.pages.map((page) => `## Page ${page.pageNumber}\n\n${page.blocks.map((block) => markdownBlock(block, page)).filter(Boolean).join("\n\n")}`);
  return `# ${document.title ?? "Extracted Text"}\n\n${pages.join("\n\n")}\n`;
}

export function buildLayoutJson(document: AnalyzedPdf): string {
  return JSON.stringify({
    schema: "paperzero-layout-v1",
    title: document.title,
    pageCount: document.pageCount,
    removedHeadersFooters: document.removedHeadersFooters,
    pages: document.pages.map((page) => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      scanned: page.scanned,
      columnCount: page.columnCount,
      blocks: page.blocks,
      tables: page.tables,
      links: page.links,
      items: page.items.map((item) => ({ text: item.text, bbox: [item.x, item.y, item.width, item.height], fontName: item.fontName, fontFamily: item.fontFamily, fontSize: item.fontSize, rotation: item.rotation, bold: item.bold, italic: item.italic, direction: item.direction })),
    })),
  }, null, 2);
}

function blockText(block: LayoutBlock, page: AnalyzedPage): string {
  if (block.kind === "table") return page.tables.find((table) => table.id === block.tableId)?.rows.map((row) => row.join("\t")).join("\n") ?? "";
  if (block.kind === "list") return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`).join("\n");
  return block.text;
}

function markdownBlock(block: LayoutBlock, page: AnalyzedPage): string {
  if (block.kind === "heading") return `${"#".repeat(Math.min(6, block.level + 2))} ${block.text}`;
  if (block.kind === "list") return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`).join("\n");
  if (block.kind === "table") {
    const rows = page.tables.find((table) => table.id === block.tableId)?.rows ?? [];
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")].map((cell) => cell.replace(/\|/g, "\\|")));
    return `| ${normalized[0]!.join(" | ")} |\n| ${normalized[0]!.map(() => "---").join(" | ")} |\n${normalized.slice(1).map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
  }
  return block.text;
}
