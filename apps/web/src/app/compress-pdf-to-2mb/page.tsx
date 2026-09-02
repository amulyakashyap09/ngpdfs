import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { CompressClient } from "../compress-pdf/CompressClient";

export const metadata: Metadata = buildToolMetadata("compress-pdf-to-2mb");

export default function CompressPdfTo2MbPage() {
  return <ToolPage slug="compress-pdf-to-2mb"><CompressClient defaultTargetBytes={2 * 1024 * 1024} /></ToolPage>;
}
