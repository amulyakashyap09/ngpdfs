import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { ScanToPdfClient } from "./ScanToPdfClient";

export const metadata: Metadata = buildToolMetadata("scan-to-pdf");

export default function ScanToPdfPage() {
  return <ToolPage slug="scan-to-pdf"><ScanToPdfClient /></ToolPage>;
}
