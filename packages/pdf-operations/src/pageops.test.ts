import { describe, expect, it } from "vitest";
import { countPages, createTextPdf } from "./test-fixtures";
import { applyPageOperations, rotateAllDescriptors } from "./ops/pageops";

describe("applyPageOperations", () => {
  it("reorders pages according to descriptors", async () => {
    const fixture = await createTextPdf("x", 3);
    const result = await applyPageOperations(fixture.bytes, [
      { index: 2, rotateDelta: 0 },
      { index: 0, rotateDelta: 0 },
      { index: 1, rotateDelta: 0 },
    ]);
    expect(await countPages(result.files[0]!.bytes)).toBe(3);
  });

  it("applies structural rotation", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const fixture = await createTextPdf("x", 2);
    const result = await applyPageOperations(fixture.bytes, rotateAllDescriptors(2, 90));
    const doc = await PDFDocument.load(result.files[0]!.bytes);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
  });

  it("accumulates rotation on already-rotated pages", async () => {
    const { PDFDocument, degrees } = await import("pdf-lib");
    const base = await createTextPdf("x", 1);
    const src = await PDFDocument.load(base.bytes);
    src.getPage(0).setRotation(degrees(270));
    const rotatedBytes = await src.save();

    const result = await applyPageOperations(rotatedBytes, [{ index: 0, rotateDelta: 180 }]);
    const out = await PDFDocument.load(result.files[0]!.bytes);
    expect(out.getPage(0).getRotation().angle).toBe(90);
  });

  it("supports duplication via repeated descriptors", async () => {
    const fixture = await createTextPdf("x", 2);
    const result = await applyPageOperations(fixture.bytes, [
      { index: 0, rotateDelta: 0 },
      { index: 0, rotateDelta: 0 },
      { index: 1, rotateDelta: 0 },
    ]);
    expect(await countPages(result.files[0]!.bytes)).toBe(3);
  });

  it("rejects deletion of every page", async () => {
    const fixture = await createTextPdf("x", 2);
    await expect(applyPageOperations(fixture.bytes, [])).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("rejects out-of-bounds page indices", async () => {
    const fixture = await createTextPdf("x", 2);
    await expect(
      applyPageOperations(fixture.bytes, [{ index: 5, rotateDelta: 0 }])
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
