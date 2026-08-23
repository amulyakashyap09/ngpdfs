import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { PdfToImagesClient } from "../pdf-to-jpg/PdfToImagesClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-zip");

export default function PdfToZipPage() {
  return (
    <ToolPage slug="pdf-to-zip">
      <PdfToImagesClient toolId="pdf-to-zip" alwaysZip />
    </ToolPage>
  );
}
