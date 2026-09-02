import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { SanitizeClient } from "./SanitizeClient";

export const metadata: Metadata = buildToolMetadata("sanitize-pdf");

export default function SanitizePage() {
  return (
    <ToolPage slug="sanitize-pdf">
      <SanitizeClient />
    </ToolPage>
  );
}
