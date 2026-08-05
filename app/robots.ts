import type { MetadataRoute } from "next";

/** Internal sales CRM — nothing here should ever show up in search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
