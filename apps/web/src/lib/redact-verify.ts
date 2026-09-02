import type { LocalDocumentFile } from "@paperzero/pdf-core";
import { createDocumentFile } from "@paperzero/pdf-core";
import { extractPdfText } from "@paperzero/pdf-operations";

export async function extractTextFromBytes(
  blob: Blob,
  signal?: AbortSignal
): Promise<Array<{ pageNumber: number; text: string }>> {
  const buffer = await blob.arrayBuffer();
  const docFile: LocalDocumentFile = createDocumentFile(buffer, {
    name: "redaction-verify.pdf",
    type: "application/pdf",
  });
  try {
    const result = await extractPdfText(docFile, {
      signal,
      onProgress: () => undefined,
    });
    return result.pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: page.lines.join("\n"),
    }));
  } finally {
    docFile.dispose();
  }
}
