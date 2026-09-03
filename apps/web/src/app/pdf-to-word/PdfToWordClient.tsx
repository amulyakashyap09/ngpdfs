"use client";

import { SemanticPdfExportClient } from "@/components/extraction/SemanticPdfExportClient";

export function PdfToWordClient() {
  return <SemanticPdfExportClient config={{
    format: "docx",
    toolId: "pdf-to-word",
    button: "Reconstruct editable Word document",
    tradeoff: "Flowing DOCX prioritizes semantic paragraphs, headings, lists, and confident tables. It will not reproduce the PDF page design exactly.",
    expected: { format: "docx", mode: "flowing editable", preserved: ["recognized paragraphs", "heuristic headings", "basic lists", "high-confidence tables", "optional source page breaks"], approximated: ["reading order", "paragraph boundaries", "heading levels", "table structure"], omitted: ["exact page layout", "source fonts", "vector graphics", "embedded images", "annotations", "PDF JavaScript"], warnings: [] },
  }} />;
}
