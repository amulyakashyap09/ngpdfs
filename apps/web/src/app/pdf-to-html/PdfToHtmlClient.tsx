"use client";

import { SemanticPdfExportClient } from "@/components/extraction/SemanticPdfExportClient";

export function PdfToHtmlClient() {
  return <SemanticPdfExportClient config={{
    format: "html",
    toolId: "pdf-to-html",
    button: "Convert PDF to safe HTML",
    tradeoff: "Choose responsive semantic HTML for accessibility and editing, or positioned layout HTML for closer text geometry. Neither mode executes PDF JavaScript.",
    expected: { format: "html", mode: "semantic or positioned", preserved: ["searchable text", "heuristic structure", "page grouping", "safe standalone output"], approximated: ["reading order", "fonts", "semantic roles or glyph placement"], omitted: ["embedded images", "complex vectors", "forms", "executable PDF JavaScript"], warnings: [] },
  }} />;
}
