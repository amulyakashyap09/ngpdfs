import { PDFDocument, degrees } from "pdf-lib";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "../pdf-utils";
import { loadPdfLibDocument, savePdfLibDocument } from "../pdf-utils";

export interface PageDescriptor {
  index: number;
  rotateDelta: number;
}

export async function applyPageOperations(
  bytes: Uint8Array,
  descriptors: PageDescriptor[],
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  if (descriptors.length === 0) {
    throw new (await import("@paperzero/shared")).PaperZeroError(
      "INVALID_INPUT",
      "The document must keep at least one page."
    );
  }
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const src = await loadPdfLibDocument(bytes);
  const pageCount = src.getPageCount();
  for (const d of descriptors) {
    if (d.index < 0 || d.index >= pageCount) {
      throw new (await import("@paperzero/shared")).PaperZeroError(
        "INVALID_INPUT",
        `Page ${d.index + 1} does not exist in this ${pageCount}-page document.`
      );
    }
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, descriptors.map((d) => d.index));
  for (let i = 0; i < descriptors.length; i++) {
    ctx.throwIfCancelled?.();
    const descriptor = descriptors[i]!;
    const page = copied[i]!;
    const original = src.getPage(descriptor.index).getRotation().angle;
    const rotation = (((original + descriptor.rotateDelta) % 360) + 360) % 360;
    page.setRotation(degrees(rotation));
    out.addPage(page);
    ctx.progress?.({
      phase: "building",
      completed: i + 1,
      total: descriptors.length,
      message: `Placing page ${i + 1} of ${descriptors.length}`,
    });
  }

  out.setProducer("PaperZero");
  const outBytes = await savePdfLibDocument(out);
  await validateOutputPdf(outBytes, { expectedPageCount: descriptors.length });
  return { files: [{ name: "organized.pdf", bytes: outBytes }], warnings: [] };
}

export function rotateAllDescriptors(
  pageCount: number,
  delta: number,
  onlyPages?: number[]
): PageDescriptor[] {
  const descriptors: PageDescriptor[] = [];
  for (let i = 0; i < pageCount; i++) {
    const pageNumber = i + 1;
    if (onlyPages && !onlyPages.includes(pageNumber)) continue;
    descriptors.push({ index: i, rotateDelta: delta });
  }
  return descriptors;
}
