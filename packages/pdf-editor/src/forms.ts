import { PDFDocument, StandardFonts } from "pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "@paperzero/pdf-operations";
import { loadPdfLibDocument, savePdfLibDocument, toExactBytes } from "@paperzero/pdf-operations";

export type FormFieldKind = "text" | "checkbox" | "radio" | "dropdown" | "optionlist" | "signature" | "button" | "unknown";

export interface FormFieldWidget {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FormFieldInfo {
  name: string;
  kind: FormFieldKind;
  value?: string;
  options?: string[];
  widgets: FormFieldWidget[];
}

function classify(field: import("pdf-lib").PDFField): FormFieldKind {
  const ctor = field.constructor.name;
  if (ctor === "PDFTextField") return "text";
  if (ctor === "PDFCheckBox") return "checkbox";
  if (ctor === "PDFRadioGroup") return "radio";
  if (ctor === "PDFDropdown") return "dropdown";
  if (ctor === "PDFOptionList") return "optionlist";
  if (ctor === "PDFSignature") return "signature";
  if (ctor === "PDFButton") return "button";
  return "unknown";
}

interface WidgetLike {
  getPage(): import("pdf-lib").PDFPage | undefined;
  getRectangle(): { x: number; y: number; width: number; height: number };
}

function widgetInfo(field: import("pdf-lib").PDFField, doc: PDFDocument): FormFieldWidget[] {
  const acroField = (field as unknown as { acroField?: { getWidgets(): WidgetLike[] } }).acroField;
  const widgets = acroField?.getWidgets() ?? [];
  const pages = doc.getPages();
  const out: FormFieldWidget[] = [];
  for (const widget of widgets) {
    try {
      const page = widget.getPage();
      let pageIndex = 0;
      if (page) {
        const ref = (page as unknown as { ref: unknown }).ref;
        const found = pages.findIndex((p) => (p as unknown as { ref: unknown }).ref === ref);
        pageIndex = found >= 0 ? found : 0;
      }
      const rect = widget.getRectangle();
      out.push({ pageIndex, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    } catch {
      continue;
    }
  }
  return out.length > 0 ? out : [{ pageIndex: 0, x: 0, y: 0, width: 0, height: 0 }];
}

export async function inspectFormFields(bytes: Uint8Array): Promise<{
  fields: FormFieldInfo[];
  isXfa: boolean;
}> {
  const doc = await loadPdfLibDocument(bytes);
  let fields: FormFieldInfo[] = [];
  try {
    const form = doc.getForm();
    fields = form.getFields().map((field) => {
      const kind = classify(field);
      const info: FormFieldInfo = { name: field.getName(), kind, widgets: widgetInfo(field, doc) };
      try {
        if (kind === "text") info.value = (field as import("pdf-lib").PDFTextField).getText() ?? "";
        if (kind === "checkbox") info.value = (field as import("pdf-lib").PDFCheckBox).isChecked() ? "true" : "false";
        if (kind === "radio" || kind === "dropdown" || kind === "optionlist") {
          const selected =
            kind === "radio"
              ? (field as import("pdf-lib").PDFRadioGroup).getSelected()
              : kind === "dropdown"
                ? (field as import("pdf-lib").PDFDropdown).getSelected()[0]
                : (field as import("pdf-lib").PDFOptionList).getSelected()[0];
          info.value = selected ?? "";
          info.options =
            kind === "radio"
              ? (field as import("pdf-lib").PDFRadioGroup).getOptions()
              : kind === "dropdown"
                ? (field as import("pdf-lib").PDFDropdown).getOptions()
                : (field as import("pdf-lib").PDFOptionList).getOptions();
        }
      } catch {
        void 0;
      }
      return info;
    });
  } catch {
    throw new PaperZeroError(
      "FILE_CORRUPT",
      "This document's form definitions could not be parsed."
    );
  }
  return { fields, isXfa: false };
}

export interface FormValuePayload {
  name: string;
  kind: FormFieldKind;
  textValue?: string;
  checked?: boolean;
}

export async function fillAndSave(
  bytes: Uint8Array,
  values: FormValuePayload[],
  options: { flattenAnswers?: boolean },
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const form = doc.getForm();

  for (let i = 0; i < values.length; i++) {
    ctx.throwIfCancelled?.();
    const value = values[i]!;
    ctx.progress?.({
      phase: "filling",
      completed: i + 1,
      total: values.length,
      message: `Setting ${value.name}`,
    });
    try {
      switch (value.kind) {
        case "text":
          form.getTextField(value.name).setText(value.textValue ?? "");
          break;
        case "checkbox": {
          const box = form.getCheckBox(value.name);
          if (value.checked) box.check();
          else box.uncheck();
          break;
        }
        case "radio":
          if (value.textValue) form.getRadioGroup(value.name).select(value.textValue);
          break;
        case "dropdown":
          if (value.textValue) form.getDropdown(value.name).select(value.textValue);
          break;
        case "optionlist":
          if (value.textValue) form.getOptionList(value.name).select(value.textValue);
          break;
        default:
          break;
      }
    } catch (error) {
      throw new PaperZeroError(
        "INVALID_INPUT",
        `Could not set the field "${value.name}". It may have changed type.`,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  const warnings: string[] = [];
  if (options.flattenAnswers) {
    try {
      form.updateFieldAppearances();
      form.flatten();
      warnings.push("Answers were flattened into the page appearance; the fields are no longer editable.");
    } catch {
      warnings.push("Flattening failed; the saved file keeps editable fields.");
    }
  }

  doc.setProducer("PaperZero");
  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: doc.getPageCount() });
  return { files: [{ name: "form-filled.pdf", bytes: toExactBytes(outBytes) }], warnings };
}

export interface TextPagesRequest {
  text: string;
  pageSize: [number, number];
  fontSize: number;
  lineHeightFactor: number;
  marginPt: number;
  title?: string;
}

export function paginateTextLines(
  text: string,
  options: { maxCharsPerLine: number; maxLinesPerPage: number }
): string[][] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (candidate.length > options.maxCharsPerLine && current.length > 0) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += options.maxLinesPerPage) {
    pages.push(lines.slice(i, i + options.maxLinesPerPage));
  }
  return pages.length > 0 ? pages : [[""]];
}

export async function buildTextPages(
  request: TextPagesRequest,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  if (!request.text.trim()) {
    throw new PaperZeroError("INVALID_INPUT", "Enter or extract some text first.");
  }
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const avgCharWidth = font.widthOfTextAtSize("n", request.fontSize);
  const usableWidth = request.pageSize[0] - request.marginPt * 2;
  const maxCharsPerLine = Math.max(10, Math.floor(usableWidth / Math.max(1, avgCharWidth)));
  const lineHeight = request.fontSize * request.lineHeightFactor;
  const usableHeight = request.pageSize[1] - request.marginPt * 2;
  const maxLinesPerPage = Math.max(4, Math.floor(usableHeight / lineHeight));

  const pages = paginateTextLines(request.text, { maxCharsPerLine, maxLinesPerPage });

  for (let p = 0; p < pages.length; p++) {
    ctx.throwIfCancelled?.();
    const page = doc.addPage(request.pageSize);
    let y = request.pageSize[1] - request.marginPt - request.fontSize;
    if (p === 0 && request.title) {
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      page.drawText(request.title, { x: request.marginPt, y, size: request.fontSize + 2, font: boldFont });
      y -= lineHeight * 1.5;
    }
    for (const line of pages[p]!) {
      if (line) {
        page.drawText(line, { x: request.marginPt, y, size: request.fontSize, font });
      }
      y -= lineHeight;
    }
    ctx.progress?.({
      phase: "composing",
      completed: p + 1,
      total: pages.length,
      message: `Composing page ${p + 1}`,
    });
  }

  doc.setProducer("PaperZero");
  const bytes = await savePdfLibDocument(doc);
  await validateOutputPdf(bytes, { expectedPageCount: pages.length });
  return { files: [{ name: "transcription.pdf", bytes: toExactBytes(bytes) }], warnings: [] };
}
