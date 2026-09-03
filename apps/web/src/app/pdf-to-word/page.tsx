import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { PdfToWordClient } from "./PdfToWordClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-word");
export default function PdfToWordPage() { return <ToolPage slug="pdf-to-word"><PdfToWordClient /></ToolPage>; }
