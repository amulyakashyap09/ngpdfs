export type ConversionSourceFormat = "markdown" | "html" | "csv" | "rich-text" | "audio";
export type ConversionFormat = ConversionSourceFormat | "epub" | "docx" | "xlsx" | "pptx" | "audio";
export type ConversionTheme = "clean" | "academic" | "technical" | "minimal";
export type ConversionPageSize = "a4" | "letter";
export type ConversionOrientation = "portrait" | "landscape";
export type TextAlignment = "left" | "center" | "right";

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: [number, number, number];
  href?: string;
}

export interface TableCell {
  runs: InlineRun[];
  align?: TextAlignment;
  fill?: [number, number, number];
}

export type DocumentBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: InlineRun[]; align?: TextAlignment }
  | { kind: "paragraph"; runs: InlineRun[]; align?: TextAlignment }
  | { kind: "list"; ordered: boolean; start?: number; items: InlineRun[][] }
  | { kind: "code"; text: string; language?: string }
  | { kind: "quote"; runs: InlineRun[] }
  | { kind: "table"; rows: TableCell[][]; headerRows?: number; striped?: boolean }
  | { kind: "image"; bytes: Uint8Array; mimeType: "image/png" | "image/jpeg"; alt?: string; widthPt?: number; heightPt?: number }
  | { kind: "rule" }
  | { kind: "page-break" };

export interface PortableDocument {
  title?: string;
  author?: string;
  blocks: DocumentBlock[];
}

export interface CsvParseOptions {
  delimiter?: "auto" | "," | ";" | "\t" | "|";
  headerRow?: boolean;
  striped?: boolean;
  maxRows?: number;
}

export interface ConversionOptions {
  pageSize: ConversionPageSize;
  orientation: ConversionOrientation;
  marginPt: number;
  theme: ConversionTheme;
  fontSize: number;
  pageNumbers: boolean;
  title?: string;
  csv?: CsvParseOptions;
  audio?: { date?: string };
}

export interface CompatibilityReport {
  format: ConversionFormat;
  preserved: string[];
  approximated: string[];
  omitted: string[];
  warnings: string[];
}

export interface ConversionPayload {
  format: ConversionSourceFormat;
  source: string;
  sourceName: string;
  options: ConversionOptions;
}

export interface BinaryConversionPayload {
  format: "epub" | "docx" | "xlsx" | "pptx";
  bytes: Uint8Array;
  sourceName: string;
  options: ConversionOptions;
  selectedSections?: string[];
}

export interface ConversionResult {
  files: Array<{ name: string; bytes: Uint8Array }>;
  warnings: string[];
  report: CompatibilityReport;
}

export interface ConversionGuard {
  readonly cancelled: boolean;
  throwIfCancelled(): void;
  progress(progress: { phase: string; completed?: number; total?: number; message?: string }): void;
}
