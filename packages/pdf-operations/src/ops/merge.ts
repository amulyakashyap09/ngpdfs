import { PaperZeroError } from "@paperzero/shared";
import { validateOutputPdf } from "@paperzero/pdf-core";
import type { OpProgressContext, NamedBytes } from "../pdf-utils";
import { loadPdfLibDocument, savePdfLibDocument } from "../pdf-utils";
import { PDFDocument } from "pdf-lib";
export interface MergeInputFile {
  name: string;
  bytes: Uint8Array;
}

export async function mergePdfBytes(
  inputs: MergeInputFile[],
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  if (inputs.length < 2) {
    throw new (await import("@paperzero/shared")).PaperZeroError(
      "INVALID_INPUT",
      "Select at least two PDF files to merge."
    );
  }
  const warnings: string[] = [];
  const out = await PDFDocument.create();
  let expectedPages = 0;

  for (let i = 0; i < inputs.length; i++) {
    ctx.throwIfCancelled?.();
    const file = inputs[i]!;
    ctx.progress?.({
      phase: "reading",
      completed: i + 1,
      total: inputs.length,
      message: `Reading ${file.name}`,
    });
    let copiedPages;
    try {
      const src = await loadPdfLibDocument(file.bytes);
      expectedPages += src.getPageCount();
      copiedPages = await out.copyPages(src, src.getPageIndices());
    } catch (error) {
      if (error instanceof PaperZeroError) throw error;
      throw new PaperZeroError(
        "FILE_CORRUPT",
        `"${file.name}" could not be read as a PDF and was rejected.`,
        error instanceof Error ? error.message : String(error)
      );
    }
    for (const page of copiedPages) out.addPage(page);
  }

  ctx.progress?.({ phase: "saving", message: "Assembling merged document" });
  out.setProducer("PaperZero");
  const bytes = await savePdfLibDocument(out);

  ctx.progress?.({ phase: "validating", message: "Validating output" });
  await validateOutputPdf(bytes, { expectedPageCount: expectedPages });

  return {
    files: [{ name: "merged.pdf", bytes }],
    warnings,
  };
}
