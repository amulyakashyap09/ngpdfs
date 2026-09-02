import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { EncryptClient } from "./EncryptClient";

export const metadata: Metadata = buildToolMetadata("encrypt-pdf");

export default function EncryptPdfPage() {
  return (
    <ToolPage slug="encrypt-pdf">
      <EncryptClient />
    </ToolPage>
  );
}
