import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { InvertColorsClient } from "./InvertColorsClient";

export const metadata: Metadata = buildToolMetadata("invert-colors");

export default function InvertColorsPage() {
  return (
    <ToolPage slug="invert-colors">
      <InvertColorsClient />
    </ToolPage>
  );
}
