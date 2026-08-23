import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { HeadersFootersClient } from "./HeadersFootersClient";

export const metadata: Metadata = buildToolMetadata("headers-footers");

export default function HeadersFootersPage() {
  return (
    <ToolPage slug="headers-footers">
      <HeadersFootersClient />
    </ToolPage>
  );
}
