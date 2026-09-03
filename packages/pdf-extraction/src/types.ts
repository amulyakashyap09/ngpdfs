export type ReadingOrderMode = "visual" | "columns";

export interface PositionedTextItem {
  id: string;
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontFamily?: string;
  fontSize: number;
  rotation: number;
  bold: boolean;
  italic: boolean;
  direction: "ltr" | "rtl";
}

export interface PositionedLink {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
}

export interface RawLayoutPage {
  pageNumber: number;
  width: number;
  height: number;
  items: PositionedTextItem[];
  links: PositionedLink[];
}

export interface LayoutLine {
  id: string;
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  bold: boolean;
  rotation: number;
  direction: "ltr" | "rtl";
  column: number;
  items: PositionedTextItem[];
}

export interface DetectedTable {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rows: string[][];
  columnBoundaries: number[];
  confidence: number;
  confidenceReasons: string[];
}

export type LayoutBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string; lineIds: string[] }
  | { kind: "paragraph"; text: string; lineIds: string[] }
  | { kind: "list"; ordered: boolean; items: string[]; lineIds: string[] }
  | { kind: "table"; tableId: string };

export interface AnalyzedPage {
  pageNumber: number;
  width: number;
  height: number;
  items: PositionedTextItem[];
  lines: LayoutLine[];
  blocks: LayoutBlock[];
  tables: DetectedTable[];
  links: PositionedLink[];
  scanned: boolean;
  columnCount: number;
}

export interface AnalyzedPdf {
  title?: string;
  pageCount: number;
  pages: AnalyzedPage[];
  removedHeadersFooters: string[];
  warnings: string[];
}

export interface LayoutAnalysisOptions {
  readingOrder?: ReadingOrderMode;
  removeRepeatedHeadersFooters?: boolean;
  tableMinConfidence?: number;
}

export interface ExtractionProgress {
  phase: string;
  completed?: number;
  total?: number;
  message?: string;
}

export interface OutputCompatibility {
  format: "docx" | "xlsx" | "pptx" | "html" | "epub";
  mode: string;
  preserved: string[];
  approximated: string[];
  omitted: string[];
  warnings: string[];
}

export interface BuiltOutput {
  files: Array<{ name: string; bytes: Uint8Array; mimeType: string }>;
  warnings: string[];
  compatibility: OutputCompatibility;
}

export interface BuildGuard {
  readonly cancelled: boolean;
  throwIfCancelled(): void;
  progress(progress: ExtractionProgress): void;
}

export interface PageRaster {
  pageNumber: number;
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  widthPx: number;
  heightPx: number;
}

export type PdfExportPayload =
  | { format: "docx"; document: AnalyzedPdf; sourceName: string; includePageBreaks: boolean }
  | { format: "xlsx"; document: AnalyzedPdf; sourceName: string; selectedTableIds: string[] }
  | { format: "pptx"; document: AnalyzedPdf; sourceName: string; rasters: PageRaster[] }
  | { format: "html"; document: AnalyzedPdf; sourceName: string; mode: "semantic" | "layout" }
  | { format: "epub"; document: AnalyzedPdf; sourceName: string; pagesPerChapter: number };
