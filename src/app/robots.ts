import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://insidely.vercel.app";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/consultor/", "/checkout/"] }, sitemap: `${base}/sitemap.xml` };
}
