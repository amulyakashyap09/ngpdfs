"use client";

import { OfficeToPdfClient } from "@/components/conversion/OfficeToPdfClient";

export function WordToPdfClient() {
  return <OfficeToPdfClient config={{
    format: "docx",
    accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx",
    extensions: ["docx"],
    label: "Choose a DOCX document or drop it here",
    hint: "DOCX · local OOXML parser · legacy DOC is not advertised · maximum 100 MB",
    button: "Convert Word document to PDF",
    maxBytes: 100 * 1024 * 1024,
    defaultOrientation: "portrait",
    expectedReport: {
      format: "docx",
      preserved: ["paragraphs and headings", "bold/italic/underline", "lists", "tables", "inline PNG/JPEG images", "page breaks", "hyperlink appearance"],
      approximated: ["Word pagination", "source fonts and run sizes", "margins", "inline image sizing", "header/footer placement"],
      omitted: ["table border styling", "equations", "SmartArt", "floating text boxes", "tracked deletions", "comments", "macros"],
      warnings: [],
    },
  }} />;
}
