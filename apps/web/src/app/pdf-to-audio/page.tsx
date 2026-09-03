import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { PdfToAudioClient } from "./PdfToAudioClient";

export const metadata: Metadata = buildToolMetadata("pdf-to-audio");
export default function PdfToAudioPage() { return <ToolPage slug="pdf-to-audio"><PdfToAudioClient /></ToolPage>; }
