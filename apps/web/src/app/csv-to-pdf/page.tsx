import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { CsvToPdfClient } from "./CsvToPdfClient";

export const metadata: Metadata = buildToolMetadata("csv-to-pdf");

export default function CsvToPdfPage() {
  return <ToolPage slug="csv-to-pdf"><CsvToPdfClient /></ToolPage>;
}
