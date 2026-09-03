import { PaperZeroError } from "@paperzero/shared";
import type { CompatibilityReport, CsvParseOptions, PortableDocument, TableCell } from "./types";

const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"] as const;

export function detectDelimiter(source: string): typeof CANDIDATE_DELIMITERS[number] {
  const sample = source.slice(0, 32_768);
  let best: { delimiter: typeof CANDIDATE_DELIMITERS[number]; score: number } = { delimiter: ",", score: -1 };
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const widths = parseCsvRows(sample, delimiter, 12).map((row) => row.length).filter((width) => width > 1);
    if (!widths.length) continue;
    const mode = widths.reduce((counts, width) => counts.set(width, (counts.get(width) ?? 0) + 1), new Map<number, number>());
    const consistency = Math.max(...mode.values());
    const score = consistency * 100 + Math.max(...widths);
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

export function parseCsv(source: string, options: CsvParseOptions = {}, title?: string): { document: PortableDocument; report: CompatibilityReport; delimiter: string } {
  if (source.length > 20 * 1024 * 1024) throw new PaperZeroError("MEMORY_LIMIT", "CSV input is limited to 20 MB to protect browser memory.");
  const delimiter = !options.delimiter || options.delimiter === "auto" ? detectDelimiter(source) : options.delimiter;
  const maxRows = Math.max(100, Math.min(options.maxRows ?? 5_000, 10_000));
  const rows = parseCsvRows(source, delimiter, maxRows + 1);
  const truncated = rows.length > maxRows;
  if (truncated) rows.length = maxRows;
  const maxColumns = Math.min(40, Math.max(0, ...rows.map((row) => row.length)));
  const normalized = rows.map((row) => Array.from({ length: maxColumns }, (_, index) => row[index] ?? ""));
  const chunks = chunkColumns(normalized, 10);
  const blocks: PortableDocument["blocks"] = [];
  chunks.forEach((chunk, index) => {
    if (index > 0) blocks.push({ kind: "page-break" });
    if (chunks.length > 1) blocks.push({ kind: "heading", level: 3, runs: [{ text: `Columns ${chunk.start + 1}–${chunk.end}` }] });
    blocks.push({
      kind: "table",
      rows: chunk.rows.map((row) => row.map<TableCell>((cell) => ({ runs: [{ text: cell }] }))),
      headerRows: options.headerRow === false ? 0 : 1,
      striped: options.striped ?? true,
    });
  });
  const warnings: string[] = [];
  if (truncated) warnings.push(`Only the first ${maxRows.toLocaleString()} rows were exported to protect browser memory.`);
  if (Math.max(0, ...rows.map((row) => row.length)) > 40) warnings.push("Columns after column 40 were omitted.");
  if (chunks.length > 1) warnings.push(`The wide table was paginated horizontally in ${chunks.length} column sections.`);
  return {
    document: { title, blocks },
    delimiter,
    report: {
      format: "csv",
      preserved: ["quoted fields", "embedded delimiters", "line breaks", "header repetition", "row striping"],
      approximated: chunks.length > 1 ? ["wide table split into column sections"] : [],
      omitted: Math.max(0, ...rows.map((row) => row.length)) > 40 ? ["columns after 40"] : [],
      warnings,
    },
  };
}

export function parseCsvRows(source: string, delimiter: string, limit = Number.POSITIVE_INFINITY): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index <= source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') quoted = false;
      else if (char === undefined) break;
      else field += char;
      continue;
    }
    if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r" || char === undefined) {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      if (rows.length >= limit) break;
    } else field += char;
  }
  return rows;
}

function chunkColumns(rows: string[][], columnsPerChunk: number): Array<{ start: number; end: number; rows: string[][] }> {
  const width = rows[0]?.length ?? 0;
  if (width === 0) return [{ start: 0, end: 0, rows: [[""]] }];
  const chunks = [];
  for (let start = 0; start < width; start += columnsPerChunk) {
    const end = Math.min(width, start + columnsPerChunk);
    chunks.push({ start, end, rows: rows.map((row) => row.slice(start, end)) });
  }
  return chunks;
}
