import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { OrganizeClient } from "./OrganizeClient";

export const metadata: Metadata = buildToolMetadata("organize-pdf");

export default function OrganizePdfPage() {
  return (
    <ToolPage slug="organize-pdf">
      <OrganizeClient />
    </ToolPage>
  );
}
