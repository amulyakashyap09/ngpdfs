import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { RemovePasswordClient } from "./RemovePasswordClient";

export const metadata: Metadata = buildToolMetadata("remove-password");

export default function RemovePasswordPage() {
  return (
    <ToolPage slug="remove-password">
      <RemovePasswordClient />
    </ToolPage>
  );
}
