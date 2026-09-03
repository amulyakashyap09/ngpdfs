import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { PowerPointToPdfClient } from "./PowerPointToPdfClient";

export const metadata: Metadata = buildToolMetadata("powerpoint-to-pdf");

export default function PowerPointToPdfPage() {
  return <ToolPage slug="powerpoint-to-pdf"><PowerPointToPdfClient /></ToolPage>;
}
