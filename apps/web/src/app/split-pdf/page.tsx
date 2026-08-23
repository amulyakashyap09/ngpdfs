import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { SplitClient } from "./SplitClient";

export const metadata: Metadata = buildToolMetadata("split-pdf");

export default function SplitPdfPage() {
  return (
    <ToolPage slug="split-pdf">
      <SplitClient />
    </ToolPage>
  );
}
