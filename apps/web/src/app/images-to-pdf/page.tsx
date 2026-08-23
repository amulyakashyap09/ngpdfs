import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { ImagesToPdfClient } from "./ImagesClient";

export const metadata: Metadata = buildToolMetadata("images-to-pdf");

export default function ImagesToPdfPage() {
  return (
    <ToolPage slug="images-to-pdf">
      <ImagesToPdfClient />
    </ToolPage>
  );
}
