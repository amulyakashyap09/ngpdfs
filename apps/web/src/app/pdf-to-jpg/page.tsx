import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { PdfToImagesClient } from "../pdf-to-jpg/PdfToImagesClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-jpg");

export default function PdfToJpgPage() {
  return (
    <ToolPage slug="pdf-to-jpg">
      <PdfToImagesClient toolId="pdf-to-jpg" alwaysZip={false} />
    </ToolPage>
  );
}
