import type { Metadata } from "next";
import { buildToolMetadata } from "@/lib/seo";
import { ToolPage } from "@/components/ToolPage";
import { SignPdfClient } from "./SignPdfClient";

export const metadata: Metadata = buildToolMetadata("sign-pdf");

export default function SignPdfPage() {
  return (
    <ToolPage slug="sign-pdf">
      <SignPdfClient />
    </ToolPage>
  );
}
