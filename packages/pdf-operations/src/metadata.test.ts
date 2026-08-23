import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createTextPdf } from "./test-fixtures";
import { readBasicMetadata, stripBasicMetadata } from "./ops/metadata";

describe("basic metadata", () => {
  it("reads fields that were set", async () => {
    const doc = await PDFDocument.create();
    doc.setTitle("Quarterly Report");
    doc.setAuthor("Jane Doe");
    doc.addPage();
    const bytes = await doc.save();
    const found = await readBasicMetadata(bytes);
    expect(found.title).toBe("Quarterly Report");
    expect(found.author).toBe("Jane Doe");
  });

  it("strips identifying fields on clean", async () => {
    const doc = await PDFDocument.create();
    doc.setTitle("Secret Draft");
    doc.setAuthor("Anonymous Person");
    doc.setSubject("Confidential subject");
    doc.addPage();
    const dirty = await doc.save();

    const result = await stripBasicMetadata(dirty);
    const cleaned = await PDFDocument.load(result.files[0]!.bytes, { updateMetadata: false });
    expect(cleaned.getTitle()).toBe("");
    expect(cleaned.getAuthor()).toBe("");
    expect(cleaned.getSubject()).toBe("");
    expect(cleaned.getPageCount()).toBe(1);
  });

  it("zeroes creation and modification dates", async () => {
    const fixture = await createTextPdf("x", 1);
    const result = await stripBasicMetadata(fixture.bytes);
    const cleaned = await PDFDocument.load(result.files[0]!.bytes, { updateMetadata: false });
    expect(cleaned.getCreationDate()?.getTime() ?? 0).toBeLessThan(1000);
    expect(cleaned.getModificationDate()?.getTime() ?? 0).toBeLessThan(1000);
  });

  it("warns about XMP limitations honestly", async () => {
    const fixture = await createTextPdf("x", 1);
    const result = await stripBasicMetadata(fixture.bytes);
    expect(result.warnings.some((w) => w.toLowerCase().includes("xmp"))).toBe(true);
  });
});
