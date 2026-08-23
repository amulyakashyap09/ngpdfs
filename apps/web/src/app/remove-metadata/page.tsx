import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { RemoveMetadataClient } from "./RemoveMetadataClient";

export const metadata: Metadata = buildToolMetadata("remove-metadata");

export default function RemoveMetadataPage() {
  return (
    <ToolPage slug="remove-metadata">
      <RemoveMetadataClient />
    </ToolPage>
  );
}
