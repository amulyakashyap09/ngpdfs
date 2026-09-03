import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { WordToPdfClient } from "./WordToPdfClient";

export const metadata: Metadata = buildToolMetadata("word-to-pdf");

export default function WordToPdfPage() {
  return <ToolPage slug="word-to-pdf"><WordToPdfClient /></ToolPage>;
}
