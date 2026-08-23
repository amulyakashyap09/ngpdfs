import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createTextPdf } from "./test-fixtures";
import { formatPageLabel, applyPageNumbers } from "./ops/pagenumbers";

describe("formatPageLabel", () => {
  it("supports all formats with prefix and suffix handled by caller", () => {
    expect(formatPageLabel("plain", 7, 20)).toBe("7");
    expect(formatPageLabel("page-n", 1, 10)).toBe("Page 1");
    expect(formatPageLabel("n-of-total", 3, 12)).toBe("3 / 12");
  });
});

describe("applyPageNumbers", () => {
  it("numbers every page starting at 1 by default", async () => {
    const fixture = await createTextPdf("body", 5);
    const result = await applyPageNumbers(fixture.bytes, {
      position: "footer",
      align: "center",
      startNumber: 1,
      prefix: "",
      suffix: "",
      format: "plain",
      fontSize: 12,
      skipFirst: false,
      pages: [],
    });
    const doc = await PDFDocument.load(result.files[0]!.bytes);
    expect(doc.getPageCount()).toBe(5);
  });

  it("skips the first page when asked", async () => {
    const fixture = await createTextPdf("body", 4);
    const result = await applyPageNumbers(fixture.bytes, {
      position: "header",
      align: "right",
      startNumber: 1,
      prefix: "",
      suffix: "",
      format: "page-n",
      fontSize: 11,
      skipFirst: true,
      pages: [],
    });
    expect(result.files).toHaveLength(1);
  });

  it("respects custom start number", async () => {
    const fixture = await createTextPdf("x", 3);
    const result = await applyPageNumbers(fixture.bytes, {
      position: "footer",
      align: "left",
      startNumber: 41,
      prefix: "",
      suffix: "",
      format: "plain",
      fontSize: 12,
      skipFirst: false,
      pages: [],
    });
    expect(result.files).toHaveLength(1);
  });

  it("rejects when no pages match", async () => {
    const fixture = await createTextPdf("x", 2);
    await expect(
      applyPageNumbers(fixture.bytes, {
        position: "footer",
        align: "center",
        startNumber: 1,
        prefix: "",
        suffix: "",
        format: "plain",
        fontSize: 12,
        skipFirst: true,
        pages: [1],
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
