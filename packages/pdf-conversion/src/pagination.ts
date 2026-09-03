import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { PaperZeroError, suggestOutputName } from "@paperzero/shared";
import type {
  CompatibilityReport,
  ConversionGuard,
  ConversionOptions,
  ConversionResult,
  DocumentBlock,
  InlineRun,
  PortableDocument,
  TableCell,
  TextAlignment,
} from "./types";

interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  mono: PDFFont;
  monoBold: PDFFont;
}

interface Fragment {
  text: string;
  font: PDFFont;
  color: [number, number, number];
  underline: boolean;
  width: number;
}

interface Line {
  fragments: Fragment[];
  width: number;
}

interface LayoutState {
  pdf: PDFDocument;
  fonts: FontSet;
  page: PDFPage;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  y: number;
  options: ConversionOptions;
  replacements: number;
}

const THEME_COLORS = {
  clean: { body: [0.12, 0.16, 0.23], heading: [0.05, 0.16, 0.35], accent: [0.15, 0.39, 0.92] },
  academic: { body: [0.12, 0.12, 0.12], heading: [0.1, 0.1, 0.1], accent: [0.35, 0.12, 0.12] },
  technical: { body: [0.1, 0.16, 0.2], heading: [0.02, 0.32, 0.4], accent: [0.02, 0.45, 0.55] },
  minimal: { body: [0.2, 0.2, 0.2], heading: [0.05, 0.05, 0.05], accent: [0.35, 0.35, 0.35] },
} satisfies Record<string, Record<string, [number, number, number]>>;

export async function buildDocumentPdf(
  document: PortableDocument,
  sourceName: string,
  options: ConversionOptions,
  report: CompatibilityReport,
  guard: ConversionGuard
): Promise<ConversionResult> {
  validateOptions(options);
  const pdf = await PDFDocument.create();
  const fonts = await embedFonts(pdf, options.theme === "academic");
  const [baseWidth, baseHeight] = options.pageSize === "letter" ? PageSizes.Letter : PageSizes.A4;
  const [pageWidth, pageHeight] = options.orientation === "landscape"
    ? [baseHeight, baseWidth]
    : [baseWidth, baseHeight];
  const page = pdf.addPage([pageWidth, pageHeight]);
  const state: LayoutState = {
    pdf,
    fonts,
    page,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - options.marginPt * 2,
    y: pageHeight - options.marginPt,
    options,
    replacements: 0,
  };

  if (options.title?.trim()) {
    await drawBlock(state, { kind: "heading", level: 1, runs: [{ text: options.title.trim() }], align: "center" });
  }
  for (let index = 0; index < document.blocks.length; index++) {
    guard.throwIfCancelled();
    guard.progress({ phase: "paginate", completed: index, total: document.blocks.length, message: `Laying out section ${index + 1}` });
    await drawBlock(state, document.blocks[index]!);
    if (index % 25 === 0) await Promise.resolve();
  }
  if (options.pageNumbers) drawPageNumbers(state);
  if (document.title || options.title) pdf.setTitle(document.title || options.title || "Document");
  if (document.author) pdf.setAuthor(document.author);
  pdf.setCreator("PaperZero local conversion");
  pdf.setProducer("PaperZero");
  guard.progress({ phase: "save", completed: document.blocks.length, total: document.blocks.length, message: "Writing PDF" });
  const bytes = await pdf.save({ useObjectStreams: true });
  const validation = await PDFDocument.load(bytes);
  if (validation.getPageCount() !== pdf.getPageCount()) throw new PaperZeroError("OUTPUT_INVALID", "Converted PDF page validation failed.");

  const warnings = [...report.warnings];
  if (state.replacements > 0) warnings.push(`${state.replacements} unsupported font characters were replaced with question marks.`);
  if (document.blocks.length === 0) warnings.push("The source contained no printable content; a blank PDF was created.");
  return {
    files: [{ name: suggestOutputName({ baseNames: [sourceName], suffix: "converted", extension: "pdf" }), bytes }],
    warnings,
    report: { ...report, warnings },
  };
}

async function drawBlock(state: LayoutState, block: DocumentBlock): Promise<void> {
  const bodySize = state.options.fontSize;
  switch (block.kind) {
    case "heading": {
      const sizes = [26, 21, 17, 14, 12, 11];
      const size = Math.max(bodySize, sizes[block.level - 1]!);
      ensureSpace(state, size * 2.2);
      if (state.y < state.pageHeight - state.options.marginPt - 2) state.y -= size * 0.35;
      drawRuns(state, block.runs.map((run) => ({ ...run, bold: block.level < 4 || run.bold })), size, block.align, 0, size * 0.65, THEME_COLORS[state.options.theme].heading);
      break;
    }
    case "paragraph":
      drawRuns(state, block.runs, bodySize, block.align, 0, bodySize * 0.7);
      break;
    case "list":
      block.items.forEach((runs, index) => {
        const marker = block.ordered ? `${(block.start ?? 1) + index}. ` : "• ";
        drawRuns(state, [{ text: marker, bold: true }, ...runs], bodySize, "left", 18, bodySize * 0.35);
      });
      state.y -= bodySize * 0.35;
      break;
    case "code":
      drawCode(state, block.text, Math.max(7, bodySize - 1));
      break;
    case "quote": {
      const startPage = state.page;
      const top = state.y;
      drawRuns(state, block.runs.map((run) => ({ ...run, italic: true })), bodySize, "left", 18, bodySize * 0.7);
      if (state.page === startPage) startPage.drawLine({ start: { x: state.options.marginPt + 5, y: state.y + bodySize * 0.5 }, end: { x: state.options.marginPt + 5, y: top }, thickness: 2, color: rgb(...THEME_COLORS[state.options.theme].accent) });
      break;
    }
    case "table":
      drawTable(state, block.rows, block.headerRows ?? 0, block.striped ?? false);
      state.y -= bodySize * 0.6;
      break;
    case "image":
      await drawImage(state, block);
      break;
    case "rule":
      ensureSpace(state, 18);
      state.page.drawLine({ start: { x: state.options.marginPt, y: state.y - 7 }, end: { x: state.pageWidth - state.options.marginPt, y: state.y - 7 }, thickness: 0.8, color: rgb(0.65, 0.68, 0.72) });
      state.y -= 18;
      break;
    case "page-break":
      if (state.y < state.pageHeight - state.options.marginPt - 1) addPage(state);
      break;
  }
}

function drawRuns(
  state: LayoutState,
  runs: InlineRun[],
  size: number,
  align: TextAlignment = "left",
  indent = 0,
  spacingAfter = size * 0.65,
  defaultColor = THEME_COLORS[state.options.theme].body
): void {
  const maxWidth = state.contentWidth - indent;
  const lines = layoutRuns(state, runs, size, maxWidth, defaultColor);
  const lineHeight = size * 1.35;
  if (lines.length > 1) ensureSpace(state, Math.min(lines.length, 2) * lineHeight);
  for (const line of lines.length ? lines : [{ fragments: [], width: 0 }]) {
    ensureSpace(state, lineHeight);
    let x = state.options.marginPt + indent;
    if (align === "center") x += (maxWidth - line.width) / 2;
    if (align === "right") x += maxWidth - line.width;
    for (const fragment of line.fragments) {
      state.page.drawText(fragment.text, { x, y: state.y - size, size, font: fragment.font, color: rgb(...fragment.color) });
      if (fragment.underline) state.page.drawLine({ start: { x, y: state.y - size - 1 }, end: { x: x + fragment.width, y: state.y - size - 1 }, thickness: 0.6, color: rgb(...fragment.color) });
      x += fragment.width;
    }
    state.y -= lineHeight;
  }
  state.y -= spacingAfter;
}

function layoutRuns(state: LayoutState, runs: InlineRun[], size: number, maxWidth: number, defaultColor: [number, number, number]): Line[] {
  const lines: Line[] = [{ fragments: [], width: 0 }];
  const addLine = () => lines.push({ fragments: [], width: 0 });
  for (const run of runs) {
    const font = selectFont(state.fonts, run);
    const safe = safeFontText(run.text, font, size);
    state.replacements += safe.replacements;
    const color = run.color ?? (run.href ? [0.1, 0.3, 0.75] : defaultColor);
    for (const token of safe.text.split(/(\n|[\t ]+)/).filter((part) => part.length > 0)) {
      if (token === "\n") {
        trimLine(lines.at(-1)!);
        addLine();
        continue;
      }
      const text = /^\s+$/.test(token) ? " " : token;
      const current = lines.at(-1)!;
      if (text === " " && current.fragments.length === 0) continue;
      const width = font.widthOfTextAtSize(text, size);
      if (current.width + width <= maxWidth) {
        current.fragments.push({ text, font, color, underline: Boolean(run.underline || run.href), width });
        current.width += width;
        continue;
      }
      if (text === " ") {
        trimLine(current);
        addLine();
        continue;
      }
      if (current.fragments.length) {
        trimLine(current);
        addLine();
      }
      addLongToken(lines, text, font, size, maxWidth, color, Boolean(run.underline || run.href));
    }
  }
  trimLine(lines.at(-1)!);
  while (lines.length > 1 && lines.at(-1)!.fragments.length === 0) lines.pop();
  return lines;
}

function addLongToken(lines: Line[], text: string, font: PDFFont, size: number, maxWidth: number, color: [number, number, number], underline: boolean): void {
  let fragment = "";
  for (const char of text) {
    const candidate = fragment + char;
    if (fragment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      const line = lines.at(-1)!;
      const width = font.widthOfTextAtSize(fragment, size);
      line.fragments.push({ text: fragment, font, color, underline, width });
      line.width = width;
      lines.push({ fragments: [], width: 0 });
      fragment = char;
    } else fragment = candidate;
  }
  if (fragment) {
    const line = lines.at(-1)!;
    const width = font.widthOfTextAtSize(fragment, size);
    line.fragments.push({ text: fragment, font, color, underline, width });
    line.width += width;
  }
}

function trimLine(line: Line): void {
  const tail = line.fragments.at(-1);
  if (tail && /^\s+$/.test(tail.text)) {
    line.width -= tail.width;
    line.fragments.pop();
  }
}

function drawCode(state: LayoutState, text: string, size: number): void {
  const padding = 7;
  const maxWidth = state.contentWidth - padding * 2;
  const lines = text.split("\n").flatMap((line) => layoutRuns(state, [{ text: line || " ", code: true }], size, maxWidth, [0.12, 0.16, 0.2]));
  const lineHeight = size * 1.35;
  for (const line of lines) {
    ensureSpace(state, lineHeight + padding * 2);
    state.page.drawRectangle({ x: state.options.marginPt, y: state.y - lineHeight - 3, width: state.contentWidth, height: lineHeight + 5, color: rgb(0.94, 0.95, 0.96) });
    let x = state.options.marginPt + padding;
    for (const fragment of line.fragments) {
      state.page.drawText(fragment.text, { x, y: state.y - size, size, font: fragment.font, color: rgb(...fragment.color) });
      x += fragment.width;
    }
    state.y -= lineHeight;
  }
  state.y -= size * 0.7;
}

function drawTable(state: LayoutState, rows: TableCell[][], headerRows: number, striped: boolean): void {
  if (!rows.length) return;
  const columns = Math.max(...rows.map((row) => row.length));
  if (columns < 1) return;
  const fontSize = Math.max(6.5, Math.min(9, state.options.fontSize - 1));
  const cellWidth = state.contentWidth / columns;
  const padding = 4;
  const maxCellLines = Math.max(1, Math.floor((state.pageHeight - state.options.marginPt * 2 - padding * 2) / (fontSize * 1.25)));
  const prepareRow = (row: TableCell[]) => {
    const layouts = Array.from({ length: columns }, (_, column) =>
      layoutRuns(state, row[column]?.runs ?? [{ text: "" }], fontSize, cellWidth - padding * 2, THEME_COLORS[state.options.theme].body).slice(0, maxCellLines)
    );
    return { layouts, rowHeight: Math.max(fontSize * 1.5, ...layouts.map((lines) => lines.length * fontSize * 1.25 + padding * 2)) };
  };
  const drawRow = (row: TableCell[], rowIndex: number, prepared = prepareRow(row)) => {
    const { layouts, rowHeight } = prepared;
    const top = state.y;
    for (let column = 0; column < columns; column++) {
      const x = state.options.marginPt + column * cellWidth;
      const header = rowIndex < headerRows;
      const cellFill = row[column]?.fill;
      const fill = cellFill ? rgb(...cellFill) : header ? rgb(0.88, 0.91, 0.95) : striped && rowIndex % 2 === 1 ? rgb(0.97, 0.98, 0.99) : rgb(1, 1, 1);
      state.page.drawRectangle({ x, y: top - rowHeight, width: cellWidth, height: rowHeight, color: fill, borderColor: rgb(0.65, 0.68, 0.72), borderWidth: 0.5 });
      let textY = top - padding;
      for (const line of layouts[column]!) {
        let textX = x + padding;
        const align = row[column]?.align;
        if (align === "center") textX += (cellWidth - padding * 2 - line.width) / 2;
        if (align === "right") textX += cellWidth - padding * 2 - line.width;
        for (const fragment of line.fragments) {
          state.page.drawText(fragment.text, { x: textX, y: textY - fontSize, size: fontSize, font: header ? state.fonts.bold : fragment.font, color: rgb(...fragment.color), maxWidth: cellWidth - padding * 2 });
          textX += fragment.width;
        }
        textY -= fontSize * 1.25;
      }
    }
    state.y -= rowHeight;
  };
  const preparedHeaders = rows.slice(0, headerRows).map((row) => prepareRow(row));
  rows.forEach((row, index) => {
    const prepared = prepareRow(row);
    if (state.y - prepared.rowHeight < state.options.marginPt) {
      addPage(state);
      if (index >= headerRows) {
        for (let header = 0; header < headerRows; header++) drawRow(rows[header]!, header, preparedHeaders[header]);
      }
    }
    drawRow(row, index, prepared);
  });
}

async function drawImage(state: LayoutState, block: Extract<DocumentBlock, { kind: "image" }>): Promise<void> {
  let image;
  try {
    image = block.mimeType === "image/png" ? await state.pdf.embedPng(block.bytes) : await state.pdf.embedJpg(block.bytes);
  } catch {
    drawRuns(state, [{ text: block.alt ? `[Image could not be decoded: ${block.alt}]` : "[Image could not be decoded]", italic: true }], state.options.fontSize, "center");
    return;
  }
  const availableHeight = state.pageHeight - state.options.marginPt * 2;
  const requestedWidth = block.widthPt ?? image.width;
  const requestedHeight = block.heightPt ?? image.height;
  const scale = Math.min(1, state.contentWidth / requestedWidth, availableHeight / requestedHeight);
  const width = requestedWidth * scale;
  const height = requestedHeight * scale;
  ensureSpace(state, height + 12);
  state.page.drawImage(image, { x: state.options.marginPt + (state.contentWidth - width) / 2, y: state.y - height, width, height });
  state.y -= height + 12;
}

function ensureSpace(state: LayoutState, height: number): void {
  if (state.y - height < state.options.marginPt) addPage(state);
}

function addPage(state: LayoutState): void {
  state.page = state.pdf.addPage([state.pageWidth, state.pageHeight]);
  state.y = state.pageHeight - state.options.marginPt;
}

function drawPageNumbers(state: LayoutState): void {
  const pages = state.pdf.getPages();
  const size = 8;
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    const width = state.fonts.regular.widthOfTextAtSize(label, size);
    page.drawText(label, { x: (state.pageWidth - width) / 2, y: Math.max(10, state.options.marginPt * 0.38), size, font: state.fonts.regular, color: rgb(0.42, 0.45, 0.5) });
  });
}

async function embedFonts(pdf: PDFDocument, academic: boolean): Promise<FontSet> {
  const names = academic
    ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic]
    : [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique];
  const regular = await pdf.embedFont(names[0]!);
  const bold = await pdf.embedFont(names[1]!);
  const italic = await pdf.embedFont(names[2]!);
  const boldItalic = await pdf.embedFont(names[3]!);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const monoBold = await pdf.embedFont(StandardFonts.CourierBold);
  return { regular, bold, italic, boldItalic, mono, monoBold };
}

function selectFont(fonts: FontSet, run: InlineRun): PDFFont {
  if (run.code) return run.bold ? fonts.monoBold : fonts.mono;
  if (run.bold && run.italic) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

function safeFontText(text: string, font: PDFFont, size: number): { text: string; replacements: number } {
  let replacements = 0;
  let safe = "";
  for (const char of text.replace(/\r\n?/g, "\n")) {
    if (char === "\n" || char === "\t") {
      safe += char;
      continue;
    }
    try {
      font.widthOfTextAtSize(char, size);
      safe += char;
    } catch {
      safe += "?";
      replacements++;
    }
  }
  return { text: safe, replacements };
}

function validateOptions(options: ConversionOptions): void {
  if (!Number.isFinite(options.marginPt) || options.marginPt < 18 || options.marginPt > 120) throw new PaperZeroError("INVALID_INPUT", "Margins must be between 18 and 120 points.");
  if (!Number.isFinite(options.fontSize) || options.fontSize < 7 || options.fontSize > 24) throw new PaperZeroError("INVALID_INPUT", "Body font size must be between 7 and 24 points.");
}
