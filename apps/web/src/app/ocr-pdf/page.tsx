import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { OcrPdfClient } from "./OcrPdfClient";

export const metadata: Metadata = buildToolMetadata("ocr-pdf");

export default function OcrPdfPage() {
  return <ToolPage slug="ocr-pdf"><OcrPdfClient /></ToolPage>;
}
