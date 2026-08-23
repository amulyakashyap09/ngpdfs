import { PaperZeroError } from "./errors";

export interface PageRangeSegment {
  start: number;
  end: number;
}

export interface ParsedRanges {
  segments: PageRangeSegment[];
  pages: number[];
  warnings: string[];
}

const TOKEN = /^(\d+)\s*-\s*(\d+)$/;

export function parsePageRanges(expression: string, pageCount: number): ParsedRanges {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new PaperZeroError("INVALID_INPUT", "Enter at least one page or range, for example 1-3,5.");
  }
  const segments: PageRangeSegment[] = [];
  const warnings: string[] = [];
  const seen = new Set<number>();

  for (const rawToken of trimmed.split(",")) {
    const token = rawToken.trim();
    if (token.length === 0) {
      throw new PaperZeroError("INVALID_INPUT", `Empty page range near "${rawToken}". Use the format 1-3,5.`);
    }
    let start: number;
    let end: number;
    if (/^\d+$/.test(token)) {
      start = end = Number.parseInt(token, 10);
    } else {
      const match = TOKEN.exec(token);
      if (!match) {
        throw new PaperZeroError("INVALID_INPUT", `"${token}" is not a valid page range. Use numbers like 3 or 1-3.`);
      }
      start = Number.parseInt(match[1]!, 10);
      end = Number.parseInt(match[2]!, 10);
    }
    if (start > end) {
      warnings.push(`Range "${token}" was reversed and normalized to ${end}-${start}.`);
      [start, end] = [end, start];
    }
    if (start < 1 || end > pageCount) {
      throw new PaperZeroError(
        "INVALID_INPUT",
        `Range "${token}" is outside this document (pages 1-${pageCount}).`
      );
    }
    segments.push({ start, end });
  }

  const pages: number[] = [];
  for (const seg of segments) {
    for (let p = seg.start; p <= seg.end; p++) {
      if (!seen.has(p)) {
        seen.add(p);
        pages.push(p);
      }
    }
  }
  return { segments, pages, warnings };
}

export function parseSelectedPages(selected: number[], pageCount: number): PageRangeSegment[] {
  const valid = [...new Set(selected)]
    .filter((p) => Number.isInteger(p) && p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const segments: PageRangeSegment[] = [];
  for (const p of valid) {
    const last = segments[segments.length - 1];
    if (last && last.end === p - 1) {
      last.end = p;
    } else {
      segments.push({ start: p, end: p });
    }
  }
  return segments;
}

export function everyNPages(pageCount: number, n: number): PageRangeSegment[] {
  const size = Math.floor(n);
  if (!Number.isFinite(size) || size < 1) {
    throw new PaperZeroError("INVALID_INPUT", "Pages per file must be a whole number of at least 1.");
  }
  const segments: PageRangeSegment[] = [];
  for (let start = 1; start <= pageCount; start += size) {
    segments.push({ start, end: Math.min(start + size - 1, pageCount) });
  }
  return segments;
}

export function singlePageSegments(pageCount: number): PageRangeSegment[] {
  return Array.from({ length: Math.max(0, pageCount) }, (_, i) => ({ start: i + 1, end: i + 1 }));
}
