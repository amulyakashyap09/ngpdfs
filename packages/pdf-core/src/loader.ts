import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { PaperZeroError } from "@paperzero/shared";
import type { LocalDocumentFile } from "./document-file";

type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

export async function getPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return pdfjsPromise;
}

const proxyCache = new Map<string, PDFDocumentProxy>();
const MAX_CACHED_DOCUMENTS = 6;

export async function loadPdfDocument(
  file: LocalDocumentFile,
  options: { password?: string } = {}
): Promise<PDFDocumentProxy> {
  const cached = proxyCache.get(file.id);
  if (cached) return cached;
  const pdfjs = await getPdfjs();
  let bytes: Uint8Array;
  try {
    const original = await file.asUint8Array();
    bytes = original.slice();
  } catch {
    throw new PaperZeroError("FILE_CORRUPT", "The selected file could not be read.");
  }
  const task = pdfjs.getDocument({
    data: bytes,
    password: options.password,
    isEvalSupported: false,
    disableAutoFetch: false,
  });
  try {
    const doc = await task.promise;
    while (proxyCache.size >= MAX_CACHED_DOCUMENTS) {
      const oldestKey = proxyCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = proxyCache.get(oldestKey);
      proxyCache.delete(oldestKey);
      void oldest?.destroy().catch(() => undefined);
    }
    proxyCache.set(file.id, doc);
    return doc;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password/i.test(message)) {
      throw new PaperZeroError(
        "ENCRYPTED_PDF",
        "This PDF is password protected and cannot be opened here. Remove the password with your PDF viewer first.",
        message
      );
    }
    if (/Invalid PDF|corrupt|structure/i.test(message)) {
      throw new PaperZeroError("FILE_CORRUPT", "This PDF appears to be damaged and could not be parsed.", message);
    }
    throw new PaperZeroError("FILE_CORRUPT", "This PDF could not be opened.", message);
  }
}

export function releasePdfDocument(fileId: string): void {
  const doc = proxyCache.get(fileId);
  proxyCache.delete(fileId);
  void doc?.destroy().catch(() => undefined);
}

export interface PageTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export async function getPageTextItems(page: PDFPageProxy): Promise<PageTextItem[]> {
  const content = await page.getTextContent();
  const raw = content.items as unknown as Array<{
    str?: unknown;
    transform?: unknown;
    width?: unknown;
    height?: unknown;
  }>;
  const out: PageTextItem[] = [];
  for (const item of raw) {
    if (
      typeof item.str === "string" &&
      Array.isArray(item.transform) &&
      typeof item.width === "number" &&
      typeof item.height === "number"
    ) {
      out.push({
        str: item.str,
        transform: item.transform as number[],
        width: item.width,
        height: item.height,
      });
    }
  }
  return out;
}
