import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { PdfToHtmlClient } from "./PdfToHtmlClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-html");
export default function PdfToHtmlPage() { return <ToolPage slug="pdf-to-html"><PdfToHtmlClient /></ToolPage>; }
