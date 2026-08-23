import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { HandwritingToPdfClient } from "./HandwritingToPdfClient";

export const metadata: Metadata = buildToolMetadata("handwriting-to-pdf");

export default function HandwritingToPdfPage() {
  return (
    <ToolPage slug="handwriting-to-pdf">
      <HandwritingToPdfClient />
    </ToolPage>
  );
}
