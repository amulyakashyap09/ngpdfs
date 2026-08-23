import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { OrganizeClient } from "../organize-pdf/OrganizeClient";

export const metadata: Metadata = buildToolMetadata("rotate-pdf");

export default function RotatePdfPage() {
  return (
    <ToolPage slug="rotate-pdf">
      <RotateClient />
    </ToolPage>
  );
}

function RotateClient() {
  return (
    <OrganizeClient
      allowDelete={false}
      allowDuplicate={false}
      toolId="rotate-pdf"
      label="Rotating pages"
    />
  );
}
