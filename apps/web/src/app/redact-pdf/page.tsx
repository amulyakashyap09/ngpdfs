import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { RedactClient } from "./RedactClient";

export const metadata: Metadata = buildToolMetadata("redact-pdf");

export default function RedactPdfPage() {
  return (
    <ToolPage slug="redact-pdf">
      <RedactClient />
    </ToolPage>
  );
}
