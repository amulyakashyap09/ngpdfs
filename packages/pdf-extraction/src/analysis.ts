import type {
  AnalyzedPage,
  AnalyzedPdf,
  DetectedTable,
  LayoutAnalysisOptions,
  LayoutBlock,
  LayoutLine,
  PositionedTextItem,
  RawLayoutPage,
} from "./types";

interface RowBand { y: number; height: number; items: PositionedTextItem[]; segments: LayoutLine[] }

export function analyzePdfLayout(rawPages: RawLayoutPage[], title?: string, options: LayoutAnalysisOptions = {}): AnalyzedPdf {
  const readingOrder = options.readingOrder ?? "columns";
  const threshold = clamp(options.tableMinConfidence ?? 0.68, 0.45, 0.95);
  const prepared = rawPages.map((page) => analyzePage(page, readingOrder, threshold));
  const repeated = options.removeRepeatedHeadersFooters === false ? new Set<string>() : repeatedMargins(prepared);
  const removedHeadersFooters = [...repeated];
  const pages = prepared.map((page) => {
    if (!repeated.size) return page;
    const lines = page.lines.filter((line) => !repeated.has(normalizeRepeated(line.text)));
    return { ...page, lines, blocks: buildBlocks(page, lines, threshold) };
  });
  const warnings: string[] = [];
  const scanned = pages.filter((page) => page.scanned).map((page) => page.pageNumber);
  if (scanned.length) warnings.push(`Pages ${compactPages(scanned)} contain no usable text layer and need local OCR before semantic conversion.`);
  if (removedHeadersFooters.length) warnings.push(`${removedHeadersFooters.length} repeated margin line${removedHeadersFooters.length === 1 ? " was" : "s were"} removed from reading order.`);
  const lowTables = pages.flatMap((page) => page.tables).filter((table) => table.confidence < threshold);
  if (lowTables.length) warnings.push(`${lowTables.length} low-confidence table candidate${lowTables.length === 1 ? " was" : "s were"} left as prose.`);
  return { title, pageCount: rawPages.length, pages, removedHeadersFooters, warnings };
}

function analyzePage(page: RawLayoutPage, readingOrder: "visual" | "columns", threshold: number): AnalyzedPage {
  const usable = page.items.filter((item) => item.text.trim() && item.width >= 0 && item.fontSize > 0);
  const bands = rowBands(usable, page.width);
  const visualLines = bands.flatMap((band) => band.segments).sort(visualSort);
  const columnCount = detectColumns(visualLines, page.width);
  const lines = readingOrder === "columns" && columnCount === 2 ? columnReadingOrder(visualLines, page.width) : visualLines.map((line) => ({ ...line, column: 0 }));
  const tables = detectTables(bands, page.pageNumber, threshold);
  const base: AnalyzedPage = {
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    items: usable,
    lines,
    blocks: [],
    tables,
    links: page.links,
    scanned: usable.length === 0,
    columnCount,
  };
  base.blocks = buildBlocks(base, lines, threshold);
  return base;
}

function rowBands(items: PositionedTextItem[], pageWidth: number): RowBand[] {
  if (!items.length) return [];
  const medianFont = median(items.map((item) => item.fontSize)) || 10;
  const tolerance = Math.max(1.5, medianFont * 0.38);
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const bands: RowBand[] = [];
  for (const item of sorted) {
    const center = item.y + item.height / 2;
    const candidate = bands.at(-1);
    const band = candidate && Math.abs(candidate.y + candidate.height / 2 - center) <= tolerance ? candidate : undefined;
    if (band) {
      band.items.push(item);
      const top = Math.min(band.y, item.y);
      const bottom = Math.max(band.y + band.height, item.y + item.height);
      band.y = top;
      band.height = bottom - top;
    } else bands.push({ y: item.y, height: item.height, items: [item], segments: [] });
  }
  bands.forEach((band, bandIndex) => {
    const rtl = band.items.filter((item) => item.direction === "rtl").length > band.items.length / 2;
    const ordered = [...band.items].sort((a, b) => rtl ? b.x - a.x : a.x - b.x);
    const splitGap = Math.max(pageWidth * 0.075, medianFont * 3.2);
    const groups: PositionedTextItem[][] = [];
    for (const item of ordered) {
      const group = groups.at(-1);
      if (!group) { groups.push([item]); continue; }
      const previous = group.at(-1)!;
      const gap = rtl ? previous.x - (item.x + item.width) : item.x - (previous.x + previous.width);
      if (gap > splitGap) groups.push([item]);
      else group.push(item);
    }
    band.segments = groups.map((group, segmentIndex) => makeLine(group, bandIndex, segmentIndex));
  });
  return bands;
}

function makeLine(items: PositionedTextItem[], bandIndex: number, segmentIndex: number): LayoutLine {
  const direction = items.filter((item) => item.direction === "rtl").length > items.length / 2 ? "rtl" : "ltr";
  const x = Math.min(...items.map((item) => item.x));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const y = Math.min(...items.map((item) => item.y));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return {
    id: `p${items[0]!.pageNumber}-r${bandIndex}-s${segmentIndex}`,
    pageNumber: items[0]!.pageNumber,
    text: joinItems(items, direction),
    x,
    y,
    width: right - x,
    height: bottom - y,
    fontSize: median(items.map((item) => item.fontSize)) || 10,
    bold: items.filter((item) => item.bold).length >= Math.ceil(items.length / 2),
    rotation: median(items.map((item) => item.rotation)),
    direction,
    column: 0,
    items,
  };
}

function joinItems(items: PositionedTextItem[], direction: "ltr" | "rtl"): string {
  let text = "";
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    if (index) {
      const previous = items[index - 1]!;
      const gap = direction === "rtl" ? previous.x - (item.x + item.width) : item.x - (previous.x + previous.width);
      const cjk = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]$/.test(text) || /^[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(item.text);
      if (gap > Math.max(1.5, item.fontSize * 0.2) && !cjk && !/\s$/.test(text) && !/^\s/.test(item.text)) text += " ";
    }
    text += item.text;
  }
  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function detectColumns(lines: LayoutLine[], pageWidth: number): number {
  const body = lines.filter((line) => line.width < pageWidth * 0.62 && line.text.length > 2);
  const left = body.filter((line) => line.x + line.width / 2 < pageWidth * 0.48);
  const right = body.filter((line) => line.x + line.width / 2 > pageWidth * 0.52);
  const separated = left.length >= 2 && right.length >= 2 && Math.max(...left.map((line) => line.x + line.width)) < Math.min(...right.map((line) => line.x)) + pageWidth * 0.08;
  return separated ? 2 : 1;
}

function columnReadingOrder(lines: LayoutLine[], pageWidth: number): LayoutLine[] {
  const annotated = lines.map((line) => {
    const crossesCenter = line.x < pageWidth * 0.48 && line.x + line.width > pageWidth * 0.52;
    return { ...line, column: line.width >= pageWidth * 0.62 || crossesCenter ? 0 : line.x + line.width / 2 < pageWidth / 2 ? 1 : 2 };
  });
  const spanning = annotated.filter((line) => line.column === 0).sort(visualSort);
  const ordered: LayoutLine[] = [];
  let top = -Infinity;
  for (const divider of [...spanning, { y: Infinity } as LayoutLine]) {
    const zone = annotated.filter((line) => line.column > 0 && line.y >= top && line.y < divider.y);
    ordered.push(...zone.filter((line) => line.column === 1).sort(visualSort));
    ordered.push(...zone.filter((line) => line.column === 2).sort(visualSort));
    if (Number.isFinite(divider.y)) ordered.push(divider);
    top = divider.y;
  }
  return ordered;
}

function detectTables(bands: RowBand[], pageNumber: number, threshold: number): DetectedTable[] {
  const groups: RowBand[][] = [];
  let current: RowBand[] = [];
  const flush = () => { if (current.length >= 3) groups.push(current); current = []; };
  for (const band of bands) {
    const cellCount = band.segments.length;
    const previous = current.at(-1);
    const near = !previous || band.y - (previous.y + previous.height) <= Math.max(24, band.height * 2.2);
    if (cellCount >= 2 && cellCount <= 12 && near) current.push(band);
    else { flush(); if (cellCount >= 2 && cellCount <= 12) current.push(band); }
  }
  flush();
  return groups.map((group, index) => tableFromRows(group, pageNumber, index)).filter((table) => table.confidence >= threshold * 0.65);
}

function tableFromRows(group: RowBand[], pageNumber: number, index: number): DetectedTable {
  const counts = group.map((row) => row.segments.length);
  const columnCount = mode(counts);
  const alignedRows = group.filter((row) => row.segments.length === columnCount);
  const boundaries = Array.from({ length: columnCount }, (_, column) => median(alignedRows.map((row) => row.segments[column]!.x)));
  const font = median(group.flatMap((row) => row.segments.map((line) => line.fontSize))) || 10;
  const deviations = alignedRows.flatMap((row) => row.segments.map((cell, column) => Math.abs(cell.x - boundaries[column]!)));
  const alignment = 1 - Math.min(1, (deviations.reduce((sum, value) => sum + value, 0) / Math.max(1, deviations.length)) / Math.max(6, font * 1.5));
  const consistency = alignedRows.length / group.length;
  const density = Math.min(1, group.length / 5);
  const firstBold = group[0]!.segments.filter((cell) => cell.bold).length / group[0]!.segments.length;
  const numericCells = group.flatMap((row) => row.segments).filter((cell) => /(?:^|\s)[-+]?[$€£¥]?[\d,.]+%?(?:\s|$)/.test(cell.text)).length;
  const numericSignal = numericCells / Math.max(1, group.flatMap((row) => row.segments).length);
  // Geometry is necessary but not sufficient: parallel prose columns can align
  // perfectly. Header emphasis and numeric data provide the semantic evidence
  // that keeps ordinary multi-column documents below the export threshold.
  const confidence = clamp(alignment * 0.4 + consistency * 0.2 + density * 0.04 + firstBold * 0.2 + numericSignal * 0.16, 0, 1);
  const x = Math.min(...group.flatMap((row) => row.segments.map((cell) => cell.x)));
  const right = Math.max(...group.flatMap((row) => row.segments.map((cell) => cell.x + cell.width)));
  const y = group[0]!.y;
  const bottom = group.at(-1)!.y + group.at(-1)!.height;
  return {
    id: `table-p${pageNumber}-${index + 1}`,
    pageNumber,
    x,
    y,
    width: right - x,
    height: bottom - y,
    rows: group.map((row) => row.segments.map((cell) => cell.text)),
    columnBoundaries: boundaries,
    confidence,
    confidenceReasons: [
      `${Math.round(alignment * 100)}% column-boundary alignment`,
      `${Math.round(consistency * 100)}% consistent column count`,
      `${group.length} aligned rows`,
      firstBold >= 0.5 ? "header emphasis detected" : "no strong header emphasis",
      `${Math.round(numericSignal * 100)}% numeric-cell signal`,
      "ruling lines were not required for this text-layer candidate",
    ],
  };
}

function buildBlocks(page: Pick<AnalyzedPage, "tables">, lines: LayoutLine[], tableThreshold: number): LayoutBlock[] {
  const confidentTables = page.tables.filter((table) => table.confidence >= tableThreshold);
  const inTable = (line: LayoutLine) => confidentTables.some((table) => line.pageNumber === table.pageNumber && line.y + line.height / 2 >= table.y - 2 && line.y + line.height / 2 <= table.y + table.height + 2 && line.x + line.width / 2 >= table.x - 2 && line.x + line.width / 2 <= table.x + table.width + 2);
  const bodyLines = lines.filter((line) => !inTable(line));
  const medianFont = median(bodyLines.map((line) => line.fontSize)) || 10;
  const entries: Array<{ order: number; block: LayoutBlock }> = confidentTables.map((table) => {
    const nextLine = bodyLines.findIndex((line) => line.y >= table.y);
    return { order: (nextLine < 0 ? bodyLines.length : nextLine) - 0.1, block: { kind: "table", tableId: table.id } };
  });
  let current: Extract<LayoutBlock, { kind: "paragraph" }> | null = null;
  const flush = () => {
    if (current) {
      const firstLine = bodyLines.findIndex((line) => line.id === current!.lineIds[0]);
      entries.push({ order: firstLine < 0 ? bodyLines.length : firstLine, block: current });
    }
    current = null;
  };
  for (const [lineIndex, line] of bodyLines.entries()) {
    const headingRatio = line.fontSize / medianFont;
    if (headingRatio >= 1.25 || (line.bold && headingRatio >= 1.1 && line.text.length < 140)) {
      flush();
      const level: 1 | 2 | 3 = headingRatio >= 1.8 ? 1 : headingRatio >= 1.4 ? 2 : 3;
      entries.push({ order: lineIndex, block: { kind: "heading", level, text: line.text, lineIds: [line.id] } });
      continue;
    }
    const list = line.text.match(/^\s*(?:(\d+)[.)]|([•●▪◦*-]))\s+(.+)$/);
    if (list) {
      flush();
      const previous = entries.at(-1)?.block;
      const ordered = Boolean(list[1]);
      if (previous?.kind === "list" && previous.ordered === ordered) { previous.items.push(list[3]!); previous.lineIds.push(line.id); }
      else entries.push({ order: lineIndex, block: { kind: "list", ordered, items: [list[3]!], lineIds: [line.id] } });
      continue;
    }
    const priorLine = current ? bodyLines.find((candidate) => candidate.id === current!.lineIds.at(-1)) : undefined;
    const joins = priorLine && priorLine.column === line.column && line.y - (priorLine.y + priorLine.height) <= medianFont * 1.7 && Math.abs(priorLine.x - line.x) <= medianFont * 2.2;
    if (!current || !joins) { flush(); current = { kind: "paragraph", text: line.text, lineIds: [line.id] }; }
    else { current.text = `${current.text}${/-$/.test(current.text) ? "" : " "}${line.text}`.replace(/-\s(?=[a-z])/i, ""); current.lineIds.push(line.id); }
  }
  flush();
  return entries.sort((a, b) => a.order - b.order).map((entry) => entry.block);
}

function repeatedMargins(pages: AnalyzedPage[]): Set<string> {
  if (pages.length < 2) return new Set();
  const counts = new Map<string, number>();
  for (const page of pages) {
    const values = new Set(page.lines.filter((line) => line.y < page.height * 0.1 || line.y + line.height > page.height * 0.9).map((line) => normalizeRepeated(line.text)).filter((text) => text.length >= 2));
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  }
  const minimum = Math.max(2, Math.ceil(pages.length * 0.6));
  return new Set([...counts].filter(([, count]) => count >= minimum).map(([text]) => text));
}

function normalizeRepeated(text: string): string { return text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim(); }
function visualSort(a: LayoutLine, b: LayoutLine): number { return a.y - b.y || a.x - b.x; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function mode(values: number[]): number { return [...new Set(values)].sort((a, b) => values.filter((value) => value === b).length - values.filter((value) => value === a).length || b - a)[0] ?? 0; }
function median(values: number[]): number { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); if (!sorted.length) return 0; const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2; }
function compactPages(pages: number[]): string { return pages.length <= 8 ? pages.join(", ") : `${pages.slice(0, 8).join(", ")} and ${pages.length - 8} more`; }
