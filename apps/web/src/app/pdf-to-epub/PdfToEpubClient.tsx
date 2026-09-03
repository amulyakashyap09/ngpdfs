"use client";

import { SemanticPdfExportClient } from "@/components/extraction/SemanticPdfExportClient";

export function PdfToEpubClient() {
  return <SemanticPdfExportClient config={{
    format: "epub",
    toolId: "pdf-to-epub",
    button: "Build reflowable EPUB",
    tradeoff: "Semantic reflow creates searchable XHTML chapters and navigation. Fixed PDF page appearance, graphics, and uncertain reading order are not disguised as a clean ebook.",
    expected: { format: "epub", mode: "semantic reflow", preserved: ["searchable text", "heuristic headings", "paragraphs", "lists", "high-confidence tables", "navigation document"], approximated: ["reading order", "chapter grouping", "heading hierarchy"], omitted: ["fixed page appearance", "embedded images", "complex vectors", "forms", "PDF JavaScript"], warnings: [] },
  }} />;
}
