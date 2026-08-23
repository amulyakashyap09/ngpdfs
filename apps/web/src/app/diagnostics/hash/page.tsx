import type { Metadata } from "next";
import { ToolPageLayout } from "@paperzero/pdf-ui";
import { HashDiagnosticClient } from "./HashDiagnosticClient";

export const metadata: Metadata = {
  title: "Developer diagnostics - Worker hash",
  description: "Internal diagnostic route proving local worker-based SHA-256 hashing with no uploads.",
  robots: { index: false },
};

export default function HashDiagnosticPage() {
  return (
    <ToolPageLayout
      tool={{
        name: "Worker hash diagnostic",
        slug: "diagnostics/hash",
        shortDescription: "Verifies the local Web Worker pipeline using a real file without uploading anything.",
        categoryLabel: "Diagnostics",
        howItWorks: [
          "Select any local file.",
          "Bytes are transferred (not copied) into a dedicated PDF worker.",
          "The worker computes a SHA-256 digest via Web Crypto.",
          "Only the digest returns to the page; the file never leaves the browser.",
        ],
        faq: [],
        offlineCapable: true,
        remoteDisclosure: null,
      }}
    >
      <HashDiagnosticClient />
    </ToolPageLayout>
  );
}
