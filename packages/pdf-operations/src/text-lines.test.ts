import { describe, expect, it } from "vitest";
import { buildMarkdown, groupItemsIntoLines } from "./text-lines";
import type { ExtractedTextItem } from "./text-lines";

function item(str: string, x: number, y: number, width = 40, height = 12): ExtractedTextItem {
  return { str, x, y, width, height };
}

describe("groupItemsIntoLines", () => {
  it("groups items sharing a baseline", () => {
    const lines = groupItemsIntoLines([
      item("Hello", 50, 700),
      item("World", 120, 700.5),
      item("Second line", 50, 660),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.text).toBe("Hello World");
    expect(lines[1]!.text).toContain("Second");
  });

  it("orders lines top to bottom", () => {
    const lines = groupItemsIntoLines([
      item("lower", 10, 300),
      item("upper", 10, 600),
    ]);
    expect(lines[0]!.text).toBe("upper");
    expect(lines[1]!.text).toBe("lower");
  });

  it("inserts spaces between horizontally distant items", () => {
    const lines = groupItemsIntoLines([
      item("WordA", 50, 500, 30),
      item("WordB", 200, 500, 30),
    ]);
    expect(lines[0]!.text).toBe("WordA WordB");
  });

  it("does not insert space for adjacent glyphs", () => {
    const lines = groupItemsIntoLines([item("Hel", 50, 100, 18), item("lo", 68, 100, 12)]);
    expect(lines[0]!.text).toBe("Hello");
  });

  it("ignores empty items", () => {
    const lines = groupItemsIntoLines([item("", 0, 0), item("x", 10, 10)]);
    expect(lines).toHaveLength(1);
  });

  it("returns empty array for no input", () => {
    expect(groupItemsIntoLines([])).toEqual([]);
  });
});

describe("buildMarkdown", () => {
  it("produces page headings", () => {
    const md = buildMarkdown([
      { pageNumber: 1, lines: ["First page text"] },
      { pageNumber: 2, lines: ["Second"] },
    ]);
    expect(md).toContain("# Extracted Text");
    expect(md).toContain("## Page 1");
    expect(md).toContain("## Page 2");
    expect(md).toContain("First page text");
  });
});
