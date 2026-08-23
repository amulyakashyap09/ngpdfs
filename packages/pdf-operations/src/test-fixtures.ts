import { PDFDocument, StandardFonts } from "pdf-lib";

export interface Fixture {
  bytes: Uint8Array;
  pageCount: number;
  text?: string;
}

export async function createTextPdf(text: string, pages = 1): Promise<Fixture> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(text, { x: 50, y: 700, size: 24, font });
  }
  return { bytes: await doc.save(), pageCount: pages, text };
}

export async function createMixedSizePdf(): Promise<Fixture> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  doc.addPage([842, 595]);
  doc.addPage([612, 792]);
  return { bytes: await doc.save(), pageCount: 3 };
}

export async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

export async function loadDoc(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes);
}
