import { StandardFonts, rgb } from "pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "@paperzero/pdf-operations";
import { loadPdfLibDocument, savePdfLibDocument, toExactBytes } from "@paperzero/pdf-operations";
import { expandTemplate, zoneX, zoneY, type HeaderFooterOptions } from "./templates";

export async function applyHeadersFooters(
  bytes: Uint8Array,
  options: HeaderFooterOptions,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const pageCount = doc.getPageCount();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const targets = [...new Set(options.pages.length > 0 ? options.pages : Array.from({ length: pageCount }, (_, i) => i + 1))]
    .filter((p) => p >= 1 && p <= pageCount && (!options.skipFirst || p > 1))
    .sort((a, b) => a - b);

  if (targets.length === 0) {
    throw new PaperZeroError("INVALID_INPUT", "No pages match the selected range.");
  }
  if (!options.header.enabled && !options.footer.enabled) {
    throw new PaperZeroError("INVALID_INPUT", "Enable at least one header or footer zone.");
  }

  for (let n = 0; n < targets.length; n++) {
    ctx.throwIfCancelled?.();
    const pageNumber = targets[n]!;
    const page = doc.getPage(pageNumber - 1);
    const { width, height } = page.getSize();
    const vars = { n: pageNumber, total: targets.length, filename: options.fileName };
    const bands: Array<["header" | "footer", typeof options.header | typeof options.footer]> = [
      ["header", options.header],
      ["footer", options.footer],
    ];
    for (const [band, zoneConfig] of bands) {
      if (!zoneConfig.enabled || !zoneConfig.template.trim()) continue;
      const zones: Array<["left" | "center" | "right", string]> = [
        ["left", extractLeft(zoneConfig.template)],
        ["center", extractCenter(zoneConfig.template)],
        ["right", extractRight(zoneConfig.template)],
      ];
      for (const [zone, rawText] of zones) {
        if (!rawText.trim()) continue;
        const text = expandTemplate(rawText, vars);
        const textWidth = font.widthOfTextAtSize(text, options.fontSize);
        page.drawText(text, {
          x: zoneX(zone, width, textWidth, options.marginPt),
          y:
            band === "header"
              ? zoneY("header", height, options.fontSize, options.marginPt)
              : zoneY("footer", height, options.fontSize, options.marginPt),
          size: options.fontSize,
          font,
          color: rgb(
            clamp01(options.color[0]),
            clamp01(options.color[1]),
            clamp01(options.color[2])
          ),
        });
      }
    }
    ctx.progress?.({
      phase: "stamping",
      completed: n + 1,
      total: targets.length,
      message: `Page ${pageNumber}`,
    });
  }

  doc.setProducer("PaperZero");
  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });
  return { files: [{ name: "headers-footers.pdf", bytes: toExactBytes(outBytes) }], warnings: [] };
}

function extractLeft(template: string): string {
  return template.split("|")[0] ?? "";
}
function extractCenter(template: string): string {
  return template.split("|")[1] ?? "";
}
function extractRight(template: string): string {
  const parts = template.split("|");
  return parts[2] ?? "";
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export interface FlattenResult {
  files: NamedBytes[];
  warnings: string[];
}

export async function flattenForms(
  bytes: Uint8Array,
  options: { rasterizeFallback?: boolean } = {},
  ctx: OpProgressContext = {}
): Promise<FlattenResult> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  const warnings: string[] = [];
  let form;
  try {
    form = doc.getForm();
  } catch {
    throw new PaperZeroError("FILE_CORRUPT", "The interactive form layer could not be read.");
  }

  const fields = form.getFields();
  if (fields.length === 0) {
    warnings.push("This document has no fillable form fields. Nothing to flatten.");
  }
  const hasSignatureFields = fields.some((f) => f.constructor.name === "PDFSignature");

  try {
    form.updateFieldAppearances();
  } catch {
    warnings.push("Some field appearances could not be generated and may render using viewer defaults.");
  }

  try {
    form.flatten();
    ctx.progress?.({ phase: "flattening", message: `Flattened ${fields.length} fields` });
  } catch {
    throw new PaperZeroError(
      "OUTPUT_INVALID",
      "This document's form fields could not be flattened. It may use unsupported field types."
    );
  }

  if (hasSignatureFields) {
    warnings.push(
      "A digital signature field was detected. Flattening removes the interactive signature appearance; existing cryptographic signatures become invalid when a signed file is modified."
    );
  }
  if (options.rasterizeFallback) {
    warnings.push("Annotation rasterization is not part of this pass; only form fields were flattened.");
  }

  doc.setProducer("PaperZero");
  const outBytes = await savePdfLibDocument(doc);
  await validateOutputPdf(outBytes, { expectedPageCount: doc.getPageCount() });
  return { files: [{ name: "flattened.pdf", bytes: toExactBytes(outBytes) }], warnings };
}
