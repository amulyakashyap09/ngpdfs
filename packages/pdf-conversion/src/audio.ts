import { PaperZeroError } from "@paperzero/shared";
import type { CompatibilityReport, InlineRun, PortableDocument } from "./types";

const TIMESTAMP = /^\s*\[((?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?)\]\s*/;

export function formatAudioTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function parseAudioTranscript(source: string, title?: string, date?: string): { document: PortableDocument; report: CompatibilityReport } {
  if (source.length > 2 * 1024 * 1024) throw new PaperZeroError("MEMORY_LIMIT", "Transcript text is limited to 2 MB.");
  const blocks: PortableDocument["blocks"] = [];
  if (date?.trim()) blocks.push({ kind: "paragraph", runs: [{ text: `Date: ${date.trim()}`, italic: true }], align: "center" });
  let timestampCount = 0;
  for (const paragraph of source.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    if (!paragraph.trim()) continue;
    const lines = paragraph.split("\n");
    const runs: InlineRun[] = [];
    for (const [index, line] of lines.entries()) {
      const match = line.match(TIMESTAMP);
      if (match) {
        timestampCount++;
        runs.push({ text: `[${match[1]}] `, bold: true, code: true, color: [0.12, 0.32, 0.58] });
        runs.push({ text: line.slice(match[0].length) });
      } else runs.push({ text: line });
      if (index < lines.length - 1) runs.push({ text: "\n" });
    }
    blocks.push({ kind: "paragraph", runs });
  }
  const warnings = [
    "Automatic speech recognition is not bundled in this build; this PDF contains only transcript text reviewed or entered by the user.",
    "The source audio is not embedded in the PDF.",
  ];
  return {
    document: { title: title?.trim() || undefined, blocks },
    report: {
      format: "audio",
      preserved: ["editable transcript text", ...(date?.trim() ? ["document date"] : []), ...(timestampCount ? ["user-inserted timestamps"] : []), "paragraph breaks"],
      approximated: [],
      omitted: ["audio media embedding", "automatic speech recognition in this build", "speaker diarization"],
      warnings,
    },
  };
}
