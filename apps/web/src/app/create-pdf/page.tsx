import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { CreatePdfClient } from "./CreatePdfClient";

export const metadata: Metadata = buildToolMetadata("create-pdf");

export default function CreatePdfPage() {
  return <ToolPage slug="create-pdf"><CreatePdfClient /></ToolPage>;
}
