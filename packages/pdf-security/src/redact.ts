import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "./internal";
import { toExactBytes } from "./internal";

export interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageRaster {
  pageIndex: number;
  bytes: Uint8Array;
  widthPt: number;
  heightPt: number;
}

export interface RedactBuildPayload {
  bytes: Uint8Array;
  regions: Array<{ pageIndex: number; rects: RedactionRect[] }>;
  rasters: PageRaster[];
  label?: string;
  overlayColor?: string;
}

function colorFromHex(value: string | undefined): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(value ?? "#000000");
  if (!match) return { r: 0, g: 0, b: 0 };
  const hex = match[1]!;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
  };
}

export async function buildRedactedPdf(
  payload: RedactBuildPayload,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  const { bytes, regions, rasters, label, overlayColor } = payload;
  const overlay = colorFromHex(overlayColor);
  const labelInk = overlay.r * 0.299 + overlay.g * 0.587 + overlay.b * 0.114 > 0.6
    ? rgb(0, 0, 0)
    : rgb(1, 1, 1);
  const pagesWithRegions = new Set(regions.map((r) => r.pageIndex));
  if (pagesWithRegions.size === 0) {
    throw new PaperZeroError("INVALID_INPUT", "Mark at least one area to redact.");
  }
  const rasterByPage = new Map(rasters.map((r) => [r.pageIndex, r]));
  for (const pageIndex of pagesWithRegions) {
    if (!rasterByPage.has(pageIndex)) {
      throw new PaperZeroError(
        "INVALID_INPUT",
        `Page ${pageIndex + 1} is missing its rendered image. Please retry.`
      );
    }
  }

  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const src = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const pageCount = src.getPageCount();
  let hadSignatures = false;
  try {
    hadSignatures = src.getForm().getFields().some((field) => field.constructor.name === "PDFSignature");
  } catch {
    void 0;
  }

  for (let i = 0; i < pageCount; i++) {
    ctx.throwIfCancelled?.();
    const raster = rasterByPage.get(i);
    if (raster) {
      const isPng =
        raster.bytes[0] === 0x89 && raster.bytes[1] === 0x50 && raster.bytes[2] === 0x4e && raster.bytes[3] === 0x47;
      const img = isPng ? await out.embedPng(raster.bytes) : await out.embedJpg(raster.bytes);
      const page = out.addPage([raster.widthPt, raster.heightPt]);
      page.drawImage(img, { x: 0, y: 0, width: raster.widthPt, height: raster.heightPt });

      const region = regions.find((r) => r.pageIndex === i);
      for (const rect of region?.rects ?? []) {
        page.drawRectangle({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          color: rgb(overlay.r, overlay.g, overlay.b),
        });
        if (label && rect.height >= 12) {
          const size = Math.min(rect.height * 0.55, rect.width / Math.max(4, (label.length * 0.6)) * 1.2, 14);
          if (size >= 5) {
            const textWidth = font.widthOfTextAtSize(label, size);
            page.drawText(label, {
              x: rect.x + Math.max(2, (rect.width - textWidth) / 2),
              y: rect.y + rect.height / 2 - size / 3,
              size,
              font,
              color: labelInk,
            });
          }
        }
      }
      ctx.progress?.({
        phase: "redacting",
        completed: i + 1,
        total: pageCount,
        message: `Redacted page ${i + 1} (content replaced)`,
      });
    } else {
      const copied = await out.copyPages(src, [i]);
      for (const page of copied) out.addPage(page);
      ctx.progress?.({
        phase: "copying",
        completed: i + 1,
        total: pageCount,
        message: `Copied page ${i + 1} unchanged`,
      });
    }
  }

  out.setProducer("PaperZero");
  const outBytes = toExactBytes(await out.save());
  await validateOutputPdf(outBytes, { expectedPageCount: pageCount });

  return {
    files: [{ name: "redacted.pdf", bytes: outBytes }],
    warnings: [
      "Pages containing redactions were rebuilt from a rendered image, permanently removing the marked content. Text on those pages becomes non-selectable.",
      "Keep the original document; redaction cannot be undone.",
      ...(hadSignatures
        ? ["This input contains signature fields. Redaction normally invalidates existing cryptographic signatures."]
        : []),
    ],
  };
}

export interface VerificationResult {
  passed: boolean;
  checkedTerms: string[];
  leftovers: string[];
}

export function verifyRedactions(
  extractedTextByPage: Array<{ pageNumber: number; text: string }>,
  markedTerms: string[]
): VerificationResult {
  const terms = [...new Set(markedTerms.map((t) => t.trim()).filter((t) => t.length >= 3))];
  if (terms.length === 0) return { passed: true, checkedTerms: [], leftovers: [] };
  const leftovers: string[] = [];
  for (const term of terms) {
    const needle = normalize(term);
    const hit = extractedTextByPage.some((page) =>
      normalize(page.text).includes(needle)
    );
    if (hit) leftovers.push(term);
  }
  return { passed: leftovers.length === 0, checkedTerms: terms, leftovers };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}
