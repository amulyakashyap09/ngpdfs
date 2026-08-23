import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { EditPdfClient } from "./EditPdfClient";

export const metadata: Metadata = buildToolMetadata("edit-pdf");

export default function EditPdfPage() {
  return (
    <ToolPage slug="edit-pdf">
      <EditPdfClient />
    </ToolPage>
  );
}
