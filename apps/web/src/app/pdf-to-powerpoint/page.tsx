import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { PdfToPowerPointClient } from "./PdfToPowerPointClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-powerpoint");
export default function PdfToPowerPointPage() { return <ToolPage slug="pdf-to-powerpoint"><PdfToPowerPointClient /></ToolPage>; }
