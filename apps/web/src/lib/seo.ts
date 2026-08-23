import type { Metadata } from "next";
import { getTool, type ToolDefinition } from "./tool-registry";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paperzero.app";
export const SITE_NAME = "PaperZero";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildToolMetadata(slug: string): Metadata {
  const tool = getTool(slug);
  const title = `${tool.name} Online Free - No Upload, No Watermark | ${SITE_NAME}`;
  const description = tool.shortDescription;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl(`/${tool.slug}`) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/${tool.slug}`),
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    keywords: [...tool.tags, tool.name, "no upload", "browser"],
  };
}

export function faqJsonLd(tool: ToolDefinition): object | null {
  if (tool.faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function softwareAppJsonLd(tool: ToolDefinition): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${tool.name} - ${SITE_NAME}`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: tool.shortDescription,
    url: absoluteUrl(`/${tool.slug}`),
  };
}
