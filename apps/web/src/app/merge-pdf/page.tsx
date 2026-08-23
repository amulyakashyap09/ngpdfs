import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { MergeClient } from "./MergeClient";

export const metadata: Metadata = buildToolMetadata("merge-pdf");

export default function MergePdfPage() {
  return (
    <ToolPage slug="merge-pdf">
      <MergeClient />
    </ToolPage>
  );
}
