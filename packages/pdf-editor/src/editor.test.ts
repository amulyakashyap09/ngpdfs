import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { countPages, createTextPdf } from "../../pdf-operations/src/test-fixtures";
import {
  applyCrop,
  applyResize,
  type CropRequest,
} from "./crop-resize";
import { applyEditorObjects, fitReplacementSize } from "./export";
import {
  buildTextPages,
  fillAndSave,
  paginateTextLines,
  type FormValuePayload,
} from "./forms";

const PNG_1PX = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

async function createFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Sample form", { x: 30, y: 260, size: 14, font });
  doc.getForm().createTextField("fullName");
  doc.getForm().getTextField("fullName").addToPage(page, { x: 30, y: 200, width: 200, height: 22 });
  doc.getForm().createCheckBox("subscribe");
  doc.getForm().getCheckBox("subscribe").addToPage(page, { x: 30, y: 160, width: 16, height: 16 });
  doc.getForm().createDropdown("color");
  doc.getForm().getDropdown("color").addOptions(["red", "green", "blue"]);
  doc.getForm().getDropdown("color").addToPage(page, { x: 30, y: 110, width: 120, height: 22 });
  return doc.save();
}

describe("applyEditorObjects", () => {
  it("draws text, whiteout and signature images without changing pages", async () => {
    const fixture = await createTextPdf("Hello world", 2);
    const result = await applyEditorObjects({
      bytes: fixture.bytes,
      objects: [
        { kind: "text", id: "t1", pageIndex: 0, x: 72, y: 700, size: 18, bold: false, color: [0.1, 0.1, 0.4], text: "Added note" },
        { kind: "whiteout", id: "w1", pageIndex: 0, x: 50, y: 690, width: 200, height: 24, color: [1, 1, 1] },
        {
          kind: "replace-text",
          id: "r1",
          pageIndex: 0,
          coverX: 49,
          coverY: 692,
          coverWidth: 120,
          coverHeight: 20,
          baselineY: 700,
          newText: "Replaced!",
          size: 24,
          color: [0, 0, 0],
          originalText: "Hello",
        },
        { kind: "image", id: "i1", pageIndex: 1, imageRef: "sig1", x: 100, y: 100, width: 120, height: 40, opacity: 1 },
      ],
      images: [{ ref: "sig1", type: "png", bytes: PNG_1PX.slice() }],
    });
    expect(result.files).toHaveLength(1);
    expect(await countPages(result.files[0]!.bytes)).toBe(2);
  });

  it("rejects empty edit sets", async () => {
    const fixture = await createTextPdf("x", 1);
    await expect(applyEditorObjects({ bytes: fixture.bytes, objects: [], images: [] })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("shrinks oversized replacement text to fit its cover box", () => {
    const font = { widthOfTextAtSize: (t: string, s: number) => t.length * s * 0.55 };
    const fitted = fitReplacementSize("A very long replacement indeed", 24, 60, font);
    expect(fitted).toBeLessThan(24);
    const unchanged = fitReplacementSize("ok", 24, 600, font);
    expect(unchanged).toBe(24);
  });
});

describe("applyCrop", () => {
  const request: CropRequest = {
    pageIndex: 0,
    rect: { x: 40, y: 500, width: 500, height: 300 },
    applyToAllPages: true,
  };

  it("sets the crop box on every page", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const fixture = await createMixedSize();
    const result = await applyCrop(fixture.bytes, request);
    const doc = await PDFDocument.load(result.files[0]!.bytes);
    for (const page of doc.getPages()) {
      const crop = page.getCropBox();
      expect(crop.width).toBeCloseTo(500, 0);
      expect(crop.height).toBeCloseTo(300, 0);
    }
  });

  it("rejects tiny crop areas", async () => {
    const fixture = await createTextPdf("x", 1);
    await expect(
      applyCrop(fixture.bytes, { pageIndex: 0, rect: { x: 10, y: 10, width: 3, height: 3 }, applyToAllPages: false })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects out-of-range pages", async () => {
    const fixture = await createTextPdf("x", 1);
    await expect(
      applyCrop(fixture.bytes, { ...request, pageIndex: 9 })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  async function createMixedSize() {
    const doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);
    doc.addPage([612, 792]);
    return { bytes: await doc.save(), pageCount: 2 };
  }
});

describe("applyResize", () => {
  it("produces A4 landscape pages with preserved content", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const fixture = await createTextPdf("content", 2);
    const result = await applyResize(fixture.bytes, {
      preset: "a4",
      orientation: "landscape",
      mode: "fit",
    });
    const doc = await PDFDocument.load(result.files[0]!.bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89);
  });

  it("supports custom mm sizes", async () => {
    const fixture = await createTextPdf("x", 1);
    const result = await applyResize(fixture.bytes, {
      preset: "custom",
      orientation: "portrait",
      custom: { width: 210, height: 297, unit: "mm" },
      mode: "center",
    });
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(result.files[0]!.bytes);
    const { width } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBeCloseTo(595, 0);
  });
});

describe("form filling", () => {
  it("inspects fields with kinds and options", async () => {
    const { inspectFormFields } = await import("./forms");
    const bytes = await createFormPdf();
    const { fields } = await inspectFormFields(bytes);
    const names = fields.map((f) => f.name);
    expect(names).toContain("fullName");
    expect(names).toContain("subscribe");
    expect(names).toContain("color");
    const colorField = fields.find((f) => f.name === "color")!;
    expect(colorField.options).toEqual(expect.arrayContaining(["red", "green", "blue"]));
  });

  it("fills values and reads them back", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const { inspectFormFields } = await import("./forms");
    const bytes = await createFormPdf();
    const values: FormValuePayload[] = [
      { name: "fullName", kind: "text", textValue: "Amulya Kashyap" },
      { name: "subscribe", kind: "checkbox", checked: true },
      { name: "color", kind: "dropdown", textValue: "blue" },
    ];
    const result = await fillAndSave(bytes, values, {});
    const doc = await PDFDocument.load(result.files[0]!.bytes);
    const form = doc.getForm();
    expect(form.getTextField("fullName").getText()).toBe("Amulya Kashyap");
    expect(form.getCheckBox("subscribe").isChecked()).toBe(true);
    expect(form.getDropdown("color").getSelected()[0]).toBe("blue");
    const reinspect = await inspectFormFields(result.files[0]!.bytes);
    expect(reinspect.fields.find((f) => f.name === "fullName")?.value).toBe("Amulya Kashyap");
  });

  it("flattens answers on request", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const bytes = await createFormPdf();
    const values: FormValuePayload[] = [{ name: "fullName", kind: "text", textValue: "Flattened Name" }];
    const result = await fillAndSave(bytes, values, { flattenAnswers: true });
    const doc = await PDFDocument.load(result.files[0]!.bytes);
    expect(doc.getForm().getFields().length).toBe(0);
  });
});

describe("paginateTextLines + buildTextPages", () => {
  it("wraps long paragraphs at the character limit", () => {
    const lines = paginateTextLines("word ".repeat(40), { maxCharsPerLine: 10, maxLinesPerPage: 100 }).flat();
    for (const line of lines) expect(line.trim().length).toBeLessThanOrEqual(10);
  });

  it("preserves blank lines as separators", () => {
    const lines = paginateTextLines("a\n\nb", { maxCharsPerLine: 80, maxLinesPerPage: 100 }).flat();
    expect(lines.filter((l) => l === "").length).toBeGreaterThanOrEqual(1);
  });

  it("paginates by maxLinesPerPage", () => {
    const pages = paginateTextLines("one\ntwo\nthree\nfour\nfive", { maxCharsPerLine: 80, maxLinesPerPage: 2 });
    expect(pages.length).toBe(3);
  });

  it("builds a valid multi-page PDF", async () => {
    const result = await buildTextPages({
      text: "Transcription line.\n".repeat(60),
      pageSize: [595.28, 841.89],
      fontSize: 12,
      lineHeightFactor: 1.5,
      marginPt: 56,
      title: "Typed transcription",
    });
    expect((await countPages(result.files[0]!.bytes))).toBeGreaterThan(1);
  });

  it("rejects empty transcription text", async () => {
    await expect(
      buildTextPages({ text: "   ", pageSize: [595.28, 841.89], fontSize: 12, lineHeightFactor: 1.5, marginPt: 56 })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
