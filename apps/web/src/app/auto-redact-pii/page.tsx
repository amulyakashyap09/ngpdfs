import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { AutoRedactClient } from "./AutoRedactClient";

export const metadata: Metadata = buildToolMetadata("auto-redact-pii");

export default function AutoRedactPiiPage() {
  return (
    <ToolPage slug="auto-redact-pii">
      <AutoRedactClient />
    </ToolPage>
  );
}
