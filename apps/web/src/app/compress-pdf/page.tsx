import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { CompressClient } from "./CompressClient";

export const metadata: Metadata = buildToolMetadata("compress-pdf");

export default function CompressPdfPage() {
  return (
    <ToolPage slug="compress-pdf">
      <CompressClient />
    </ToolPage>
  );
}
