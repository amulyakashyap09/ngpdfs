import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo";
import { AudioToPdfClient } from "./AudioToPdfClient";

export const metadata: Metadata = buildToolMetadata("audio-to-pdf");

export default function AudioToPdfPage() {
  return <ToolPage slug="audio-to-pdf"><AudioToPdfClient /></ToolPage>;
}
