import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { FillFormClient } from "./FillFormClient";

export const metadata: Metadata = buildToolMetadata("fill-form-pdf");

export default function FillFormPage() {
  return (
    <ToolPage slug="fill-form-pdf">
      <FillFormClient />
    </ToolPage>
  );
}
