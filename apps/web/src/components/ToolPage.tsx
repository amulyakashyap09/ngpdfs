import { ToolPageLayout } from "@paperzero/pdf-ui";
import { faqJsonLd, softwareAppJsonLd } from "@/lib/seo";
import { CATEGORY_LABELS, getRelatedTools, getTool } from "@/lib/tool-registry";

export function ToolPage({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const tool = getTool(slug);
  const related = getRelatedTools(tool);
  const jsonLd = [faqJsonLd(tool), softwareAppJsonLd(tool)].filter(Boolean);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ToolPageLayout
        tool={{
          name: tool.name,
          slug: tool.slug,
          shortDescription: tool.longDescription,
          categoryLabel: CATEGORY_LABELS[tool.category],
          howItWorks: tool.howItWorks,
          faq: tool.faq,
          offlineCapable: tool.offlineCapable,
          remoteDisclosure: tool.remoteProcessingDisclosure,
        }}
        related={related}
      >
        {children}
      </ToolPageLayout>
    </>
  );
}
