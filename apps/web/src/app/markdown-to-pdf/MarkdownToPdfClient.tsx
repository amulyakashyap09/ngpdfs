"use client";

import { SourceToPdfClient } from "@/components/conversion/SourceToPdfClient";

export function MarkdownToPdfClient() {
  return <SourceToPdfClient config={{
    format: "markdown",
    accept: "text/markdown,text/plain,.md,.markdown,.txt",
    uploadLabel: "Choose a Markdown file or drop it here",
    uploadHint: "MD · Markdown · TXT · maximum 20 MB",
    editorLabel: "Markdown source",
    placeholder: "# Document title\n\nWrite **formatted** Markdown here…",
    initialSource: "# Local Markdown to PDF\n\nEdit this content or import a `.md` file.\n\n- Runs entirely in your browser\n- Supports tables, code, lists, quotes, and page breaks\n\n```text\nNo upload is performed.\n```",
  }} />;
}
