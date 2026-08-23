import type { OpProgressContext, NamedBytes } from "../pdf-utils";
import { loadPdfLibDocument, savePdfLibDocument } from "../pdf-utils";

const EPOCH = new Date(0);

export interface BasicMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

function fmt(date: Date | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export async function readBasicMetadata(bytes: Uint8Array): Promise<BasicMetadata> {
  const doc = await loadPdfLibDocument(bytes);
  const keywords = doc.getKeywords();
  return {
    title: doc.getTitle() || undefined,
    author: doc.getAuthor() || undefined,
    subject: doc.getSubject() || undefined,
    keywords: Array.isArray(keywords) ? keywords.join(", ") : keywords || undefined,
    creator: doc.getCreator() || undefined,
    producer: doc.getProducer() || undefined,
    creationDate: fmt(doc.getCreationDate()),
    modificationDate: fmt(doc.getModificationDate()),
  };
}

export async function stripBasicMetadata(
  bytes: Uint8Array,
  ctx: OpProgressContext = {}
): Promise<{ files: NamedBytes[]; warnings: string[] }> {
  ctx.progress?.({ phase: "reading", message: "Reading document" });
  const doc = await loadPdfLibDocument(bytes);
  ctx.progress?.({ phase: "cleaning", message: "Removing metadata fields" });
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setCreator("PaperZero");
  doc.setProducer("PaperZero");
  doc.setCreationDate(EPOCH);
  doc.setModificationDate(EPOCH);
  const outBytes = await savePdfLibDocument(doc);
  ctx.progress?.({ phase: "validating", message: "Validating output" });
  await (await import("@paperzero/pdf-core")).validateOutputPdf(outBytes, {
    expectedPageCount: doc.getPageCount(),
  });
  return {
    files: [{ name: "metadata-removed.pdf", bytes: outBytes }],
    warnings: [
      "Basic document properties were removed. Embedded XMP packets and some internal traces may still exist; a deeper privacy cleaner is planned.",
    ],
  };
}
