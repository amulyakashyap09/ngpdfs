import { PaperZeroError } from "@paperzero/shared";
import { parseCsv } from "./csv";
import { parseHtml } from "./html";
import { parseMarkdown } from "./markdown";
import { buildDocumentPdf } from "./pagination";
import { parseEbook } from "./epub";
import { parseDocx } from "./docx";
import { parseXlsx } from "./xlsx";
import { convertPptxToPdf } from "./pptx";
import { parseAudioTranscript } from "./audio";
import type { BinaryConversionPayload, ConversionGuard, ConversionPayload, ConversionResult } from "./types";

export async function convertSourceToPdf(payload: ConversionPayload, guard: ConversionGuard): Promise<ConversionResult> {
  if (payload.source.length > 25 * 1024 * 1024) throw new PaperZeroError("MEMORY_LIMIT", "Text-based conversion input is limited to 25 MB.");
  guard.throwIfCancelled();
  guard.progress({ phase: "parse", completed: 0, total: 1, message: `Parsing ${payload.format}` });
  const parsed = payload.format === "markdown"
    ? parseMarkdown(payload.source, payload.options.title)
    : payload.format === "audio"
      ? parseAudioTranscript(payload.source, payload.options.title, payload.options.audio?.date)
    : payload.format === "csv"
      ? parseCsv(payload.source, payload.options.csv, payload.options.title)
      : parseHtml(payload.source, payload.options.title, payload.format);
  guard.throwIfCancelled();
  return buildDocumentPdf(parsed.document, payload.sourceName, payload.options, parsed.report, guard);
}

export async function convertBinaryToPdf(payload: BinaryConversionPayload, guard: ConversionGuard): Promise<ConversionResult> {
  if (payload.format === "pptx") {
    return convertPptxToPdf(payload.bytes, payload.sourceName, payload.selectedSections, guard);
  }
  const parsed = payload.format === "epub"
    ? await parseEbook(payload.bytes, payload.sourceName, guard)
    : payload.format === "docx"
      ? await parseDocx(payload.bytes, payload.sourceName, guard)
      : payload.format === "xlsx"
        ? await parseXlsx(payload.bytes, payload.sourceName, payload.selectedSections, guard)
      : null;
  if (!parsed) throw new PaperZeroError("UNSUPPORTED_FILE", `${payload.format.toUpperCase()} conversion is not wired yet.`);
  guard.throwIfCancelled();
  return buildDocumentPdf(parsed.document, payload.sourceName, payload.options, parsed.report, guard);
}
