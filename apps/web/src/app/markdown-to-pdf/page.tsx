import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { MarkdownToPdfClient } from "./MarkdownToPdfClient";

export const metadata: Metadata = buildToolMetadata("markdown-to-pdf");

export default function MarkdownToPdfPage() {
  return <ToolPage slug="markdown-to-pdf"><MarkdownToPdfClient /></ToolPage>;
}
