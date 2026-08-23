import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { CropResizeClient } from "./CropResizeClient";

export const metadata: Metadata = buildToolMetadata("crop-resize-pdf");

export default function CropResizePage() {
  return (
    <ToolPage slug="crop-resize-pdf">
      <CropResizeClient />
    </ToolPage>
  );
}
