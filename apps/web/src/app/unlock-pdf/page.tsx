import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { UnlockClient } from "./UnlockClient";

export const metadata: Metadata = buildToolMetadata("unlock-pdf");

export default function UnlockPdfPage() {
  return (
    <ToolPage slug="unlock-pdf">
      <UnlockClient />
    </ToolPage>
  );
}
