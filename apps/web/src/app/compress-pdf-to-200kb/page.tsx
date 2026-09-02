import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { CompressClient } from "../compress-pdf/CompressClient";

export const metadata: Metadata = buildToolMetadata("compress-pdf-to-200kb");

export default function CompressPdfTo200KbPage() {
  return <ToolPage slug="compress-pdf-to-200kb"><CompressClient defaultTargetBytes={200 * 1024} /></ToolPage>;
}
