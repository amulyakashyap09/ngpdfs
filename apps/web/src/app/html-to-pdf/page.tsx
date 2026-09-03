import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { HtmlToPdfClient } from "./HtmlToPdfClient";

export const metadata: Metadata = buildToolMetadata("html-to-pdf");

export default function HtmlToPdfPage() {
  return <ToolPage slug="html-to-pdf"><HtmlToPdfClient /></ToolPage>;
}
