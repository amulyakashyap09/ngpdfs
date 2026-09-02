import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { CompressClient } from "../compress-pdf/CompressClient";

export const metadata: Metadata = buildToolMetadata("compress-pdf-to-100kb");

export default function CompressPdfTo100KbPage() {
  return <ToolPage slug="compress-pdf-to-100kb"><CompressClient defaultTargetBytes={100 * 1024} /></ToolPage>;
}
