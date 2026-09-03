import { marked, type Token, type Tokens } from "marked";
import type { CompatibilityReport, DocumentBlock, InlineRun, PortableDocument, TableCell } from "./types";
import { decodeDataImage, mergeRuns, safeHref } from "./utils";

export function parseMarkdown(source: string, title?: string): { document: PortableDocument; report: CompatibilityReport } {
  const report: CompatibilityReport = {
    format: "markdown",
    preserved: ["headings", "paragraphs", "emphasis", "lists", "code blocks", "blockquotes", "tables", "links", "page breaks"],
    approximated: ["widow/orphan control", "link annotations"],
    omitted: [],
    warnings: [],
  };
  const blocks: DocumentBlock[] = [];
  for (const token of marked.lexer(source, { gfm: true, breaks: false })) {
    switch (token.type) {
      case "heading":
        {
          const heading = token as Tokens.Heading;
          blocks.push({ kind: "heading", level: Math.min(6, Math.max(1, heading.depth)) as 1 | 2 | 3 | 4 | 5 | 6, runs: inlineRuns(heading.tokens) });
        }
        break;
      case "paragraph": {
        const paragraph = token as Tokens.Paragraph;
        const only = paragraph.tokens[0];
        const image = paragraph.tokens.length === 1 && only?.type === "image" ? decodeDataImage((only as Tokens.Image).href) : null;
        if (image) blocks.push({ kind: "image", ...image, alt: only?.type === "image" ? (only as Tokens.Image).text : undefined });
        else blocks.push({ kind: "paragraph", runs: inlineRuns(paragraph.tokens) });
        break;
      }
      case "list": {
        const list = token as Tokens.List;
        blocks.push({
          kind: "list",
          ordered: list.ordered,
          start: typeof list.start === "number" ? list.start : undefined,
          items: list.items.map((item: Tokens.ListItem) => inlineRuns(item.tokens.flatMap((itemToken: Token) => itemToken.type === "paragraph" ? (itemToken as Tokens.Paragraph).tokens : [itemToken]))),
        });
        break;
      }
      case "code": {
        const code = token as Tokens.Code;
        blocks.push({ kind: "code", text: code.text, language: code.lang });
        break;
      }
      case "blockquote": {
        const quote = token as Tokens.Blockquote;
        blocks.push({ kind: "quote", runs: inlineRuns(flattenInlineTokens(quote.tokens)) });
        break;
      }
      case "table": {
        const table = token as Tokens.Table;
        const header = table.header.map((cell: Tokens.TableCell): TableCell => ({ runs: inlineRuns(cell.tokens), align: cell.align ?? undefined }));
        const rows = table.rows.map((row: Tokens.TableCell[]) => row.map((cell: Tokens.TableCell): TableCell => ({ runs: inlineRuns(cell.tokens), align: cell.align ?? undefined })));
        blocks.push({ kind: "table", rows: [header, ...rows], headerRows: 1, striped: true });
        break;
      }
      case "hr":
        blocks.push({ kind: "rule" });
        break;
      case "html":
        if (/^\s*<!--\s*pagebreak\s*-->\s*$/i.test((token as Tokens.HTML).text) || /page-break-(?:before|after)\s*:\s*always/i.test((token as Tokens.HTML).text)) {
          blocks.push({ kind: "page-break" });
        } else {
          report.omitted.push("raw HTML blocks");
        }
        break;
      case "space":
      case "def":
        break;
      default:
        if ("tokens" in token && Array.isArray(token.tokens)) {
          const runs = inlineRuns(token.tokens);
          if (runs.length) blocks.push({ kind: "paragraph", runs });
        }
    }
  }
  if (report.omitted.length) report.warnings.push("Raw HTML inside Markdown is omitted unless it is an explicit page-break marker.");
  return { document: { title, blocks }, report };
}

function flattenInlineTokens(tokens: Token[]): Token[] {
  return tokens.flatMap((token): Token[] => token.type === "paragraph"
    ? (token as Tokens.Paragraph).tokens
    : "tokens" in token && Array.isArray(token.tokens)
      ? token.tokens.filter((item): item is Token => Boolean(item))
      : [token]);
}

function inlineRuns(tokens: Token[], inherited: Omit<InlineRun, "text"> = {}): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text":
        {
          const text = token as Tokens.Text;
          if (text.tokens?.length) runs.push(...inlineRuns(text.tokens, inherited));
          else runs.push({ text: text.text, ...inherited });
        }
        break;
      case "escape":
        runs.push({ text: (token as Tokens.Escape).text, ...inherited });
        break;
      case "strong":
        runs.push(...inlineRuns((token as Tokens.Strong).tokens, { ...inherited, bold: true }));
        break;
      case "em":
        runs.push(...inlineRuns((token as Tokens.Em).tokens, { ...inherited, italic: true }));
        break;
      case "del":
        runs.push(...inlineRuns((token as Tokens.Del).tokens, inherited));
        break;
      case "codespan":
        runs.push({ text: (token as Tokens.Codespan).text, ...inherited, code: true });
        break;
      case "link": {
        const link = token as Tokens.Link;
        runs.push(...inlineRuns(link.tokens, { ...inherited, underline: true, color: [0.1, 0.3, 0.75], href: safeHref(link.href) }));
        break;
      }
      case "image": {
        const image = token as Tokens.Image;
        runs.push({ text: image.text ? `[Image: ${image.text}]` : "[Image]", ...inherited, italic: true });
        break;
      }
      case "br":
        runs.push({ text: "\n", ...inherited });
        break;
      default:
        if ("tokens" in token && Array.isArray(token.tokens)) runs.push(...inlineRuns(token.tokens, inherited));
    }
  }
  return mergeRuns(runs);
}
