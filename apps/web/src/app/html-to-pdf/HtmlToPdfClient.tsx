"use client";

import { SourceToPdfClient } from "@/components/conversion/SourceToPdfClient";

export function HtmlToPdfClient() {
  return <SourceToPdfClient config={{
    format: "html",
    accept: "text/html,.html,.htm",
    uploadLabel: "Choose a local HTML file or drop it here",
    uploadHint: "HTML/HTM · scripts and external resources are blocked",
    editorLabel: "Safe HTML source",
    placeholder: "<h1>Document title</h1><p>Safe local content…</p>",
    initialSource: "<h1>Safe HTML to PDF</h1><p>This source is parsed structurally. <strong>Scripts never execute</strong>, frames are removed, and external images are blocked.</p><blockquote>Inline typography, lists, tables, and embedded data images are supported.</blockquote>",
  }} />;
}
