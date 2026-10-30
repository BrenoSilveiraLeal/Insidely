import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://insidely.vercel.app";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/", "/consultor/", "/checkout/", "/conversa/", "/recibo/", "/sala/", "/agendar/", "/api/", "/auth/", "/onboarding", "/identificacao", "/aceitar-termos", "/conta-suspensa", "/mfa"] }, sitemap: `${base}/sitemap.xml` };
}
