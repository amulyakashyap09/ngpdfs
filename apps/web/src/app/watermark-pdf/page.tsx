import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { WatermarkClient } from "./WatermarkClient";

export const metadata: Metadata = buildToolMetadata("watermark-pdf");

export default function WatermarkPdfPage() {
  return (
    <ToolPage slug="watermark-pdf">
      <WatermarkClient />
    </ToolPage>
  );
}
