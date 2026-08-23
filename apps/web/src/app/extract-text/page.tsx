import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { ExtractTextClient } from "./ExtractTextClient";

export const metadata: Metadata = buildToolMetadata("extract-text");

export default function ExtractTextPage() {
  return (
    <ToolPage slug="extract-text">
      <ExtractTextClient />
    </ToolPage>
  );
}
