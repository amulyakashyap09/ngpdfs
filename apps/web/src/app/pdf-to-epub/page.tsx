import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { PdfToEpubClient } from "./PdfToEpubClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-epub");
export default function PdfToEpubPage() { return <ToolPage slug="pdf-to-epub"><PdfToEpubClient /></ToolPage>; }
