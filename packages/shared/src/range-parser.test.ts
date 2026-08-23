import { describe, expect, it } from "vitest";
import { everyNPages, parsePageRanges, parseSelectedPages, singlePageSegments } from "./range-parser";
import { PaperZeroError } from "./errors";

describe("parsePageRanges", () => {
  it("parses single pages and ranges", () => {
    const result = parsePageRanges("1-3,5,8-10", 20);
    expect(result.pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
    expect(result.segments).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 5 },
      { start: 8, end: 10 },
    ]);
  });

  it("deduplicates overlapping ranges", () => {
    const result = parsePageRanges("1-5,3-7", 10);
    expect(result.pages).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("normalizes reversed ranges with warning", () => {
    const result = parsePageRanges("5-2", 10);
    expect(result.pages).toEqual([2, 3, 4, 5]);
    expect(result.warnings).toHaveLength(1);
  });

  it("allows whitespace", () => {
    expect(parsePageRanges(" 1 - 3 , 7 ", 10).pages).toEqual([1, 2, 3, 7]);
  });

  it("rejects empty input", () => {
    expect(() => parsePageRanges("", 10)).toThrow(PaperZeroError);
    expect(() => parsePageRanges("  ", 10)).toThrow(PaperZeroError);
  });

  it("rejects non-numeric input", () => {
    expect(() => parsePageRanges("abc", 10)).toThrow(PaperZeroError);
    expect(() => parsePageRanges("1,,3", 10)).toThrow(PaperZeroError);
  });

  it("rejects pages beyond document length", () => {
    expect(() => parsePageRanges("11", 10)).toThrow(PaperZeroError);
    expect(() => parsePageRanges("1-11", 10)).toThrow(PaperZeroError);
  });

  it("rejects zero and negative pages", () => {
    expect(() => parsePageRanges("0", 10)).toThrow(PaperZeroError);
    expect(() => parsePageRanges("-3", 10)).toThrow(PaperZeroError);
  });
});

describe("everyNPages", () => {
  it("chunks evenly and handles remainder", () => {
    expect(everyNPages(10, 3)).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 6 },
      { start: 7, end: 9 },
      { start: 10, end: 10 },
    ]);
  });

  it("single chunk when n covers document", () => {
    expect(everyNPages(4, 10)).toEqual([{ start: 1, end: 4 }]);
  });

  it("rejects invalid chunk size", () => {
    expect(() => everyNPages(10, 0)).toThrow(PaperZeroError);
    expect(() => everyNPages(10, -2)).toThrow(PaperZeroError);
  });
});

describe("parseSelectedPages", () => {
  it("merges contiguous selections into segments", () => {
    expect(parseSelectedPages([1, 2, 3, 7], 10)).toEqual([
      { start: 1, end: 3 },
      { start: 7, end: 7 },
    ]);
  });

  it("ignores out-of-range and duplicates", () => {
    expect(parseSelectedPages([5, 5, 99, 0, -1], 10)).toEqual([{ start: 5, end: 5 }]);
  });
});

describe("singlePageSegments", () => {
  it("creates one segment per page", () => {
    expect(singlePageSegments(3)).toEqual([
      { start: 1, end: 1 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
    ]);
  });
});
