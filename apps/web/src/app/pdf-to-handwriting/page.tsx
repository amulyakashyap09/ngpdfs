import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { PdfToHandwritingClient } from "./PdfToHandwritingClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-handwriting");

export default function PdfToHandwritingPage() {
  return (
    <ToolPage slug="pdf-to-handwriting">
      <PdfToHandwritingClient />
    </ToolPage>
  );
}
