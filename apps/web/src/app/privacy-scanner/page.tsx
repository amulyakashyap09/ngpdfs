import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { PrivacyScannerClient } from "./PrivacyScannerClient";

export const metadata: Metadata = buildToolMetadata("privacy-scanner");

export default function PrivacyScannerPage() {
  return (
    <ToolPage slug="privacy-scanner">
      <PrivacyScannerClient />
    </ToolPage>
  );
}
