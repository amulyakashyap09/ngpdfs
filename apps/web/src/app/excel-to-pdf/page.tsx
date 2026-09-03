import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { ExcelToPdfClient } from "./ExcelToPdfClient";

export const metadata: Metadata = buildToolMetadata("excel-to-pdf");

export default function ExcelToPdfPage() {
  return <ToolPage slug="excel-to-pdf"><ExcelToPdfClient /></ToolPage>;
}
