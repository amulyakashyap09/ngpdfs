import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { EbookToPdfClient } from "./EbookToPdfClient";

export const metadata: Metadata = buildToolMetadata("ebook-to-pdf");

export default function EbookToPdfPage() {
  return <ToolPage slug="ebook-to-pdf"><EbookToPdfClient /></ToolPage>;
}
