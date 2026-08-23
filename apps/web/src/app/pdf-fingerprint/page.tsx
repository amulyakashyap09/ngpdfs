import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { FingerprintClient } from "./FingerprintClient";

export const metadata: Metadata = buildToolMetadata("pdf-fingerprint");

export default function PdfFingerprintPage() {
  return (
    <ToolPage slug="pdf-fingerprint">
      <FingerprintClient />
    </ToolPage>
  );
}
