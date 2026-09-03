import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { PdfToExcelClient } from "./PdfToExcelClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-excel");
export default function PdfToExcelPage() { return <ToolPage slug="pdf-to-excel"><PdfToExcelClient /></ToolPage>; }
