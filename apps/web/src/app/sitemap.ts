import type { MetadataRoute } from "next";
import { getAvailableTools } from "@/lib/tool-registry";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/privacy", "/how-it-works", "/offline"].map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.5,
  }));
  const tools = getAvailableTools().map((tool) => ({
    url: absoluteUrl(`/${tool.slug}`),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [...staticPages, ...tools];
}
