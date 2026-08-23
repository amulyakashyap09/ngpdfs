import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { FlattenClient } from "./FlattenClient";

export const metadata: Metadata = buildToolMetadata("flatten-pdf");

export default function FlattenPdfPage() {
  return (
    <ToolPage slug="flatten-pdf">
      <FlattenClient />
    </ToolPage>
  );
}
