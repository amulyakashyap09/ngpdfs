import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { PageNumbersClient } from "./PageNumbersClient";

export const metadata: Metadata = buildToolMetadata("add-page-numbers");

export default function AddPageNumbersPage() {
  return (
    <ToolPage slug="add-page-numbers">
      <PageNumbersClient />
    </ToolPage>
  );
}
