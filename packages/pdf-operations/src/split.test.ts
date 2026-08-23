import { describe, expect, it } from "vitest";
import { countPages, createTextPdf } from "./test-fixtures";
import { splitPdfBytes } from "./ops/split";

describe("splitPdfBytes", () => {
  it("extracts a range into its own file", async () => {
    const fixture = await createTextPdf("content", 6);
    const result = await splitPdfBytes(fixture.bytes, {
      baseName: "report.pdf",
      segments: [{ start: 2, end: 4 }],
    });
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.name).toBe("report-pages-2-4.pdf");
    expect(await countPages(result.files[0]!.bytes)).toBe(3);
  });

  it("splits every page with predictable names", async () => {
    const fixture = await createTextPdf("x", 3);
    const result = await splitPdfBytes(fixture.bytes, {
      baseName: "doc",
      segments: [
        { start: 1, end: 1 },
        { start: 2, end: 2 },
        { start: 3, end: 3 },
      ],
    });
    expect(result.files.map((f) => f.name)).toEqual([
      "doc-page-1.pdf",
      "doc-page-2.pdf",
      "doc-page-3.pdf",
    ]);
  });

  it("supports multiple non-overlapping ranges in order", async () => {
    const fixture = await createTextPdf("x", 10);
    const result = await splitPdfBytes(fixture.bytes, {
      baseName: "book",
      segments: [
        { start: 1, end: 2 },
        { start: 5, end: 5 },
        { start: 8, end: 10 },
      ],
    });
    expect(await Promise.all(result.files.map((f) => countPages(f.bytes)))).toEqual([2, 1, 3]);
  });

  it("rejects ranges beyond the document", async () => {
    const fixture = await createTextPdf("x", 2);
    await expect(
      splitPdfBytes(fixture.bytes, { baseName: "d", segments: [{ start: 1, end: 5 }] })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects empty segment list", async () => {
    const fixture = await createTextPdf("x", 2);
    await expect(
      splitPdfBytes(fixture.bytes, { baseName: "d", segments: [] })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
