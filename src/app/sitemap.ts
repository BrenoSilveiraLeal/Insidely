import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://insidely.vercel.app";
  return ["", "/buscar", "/empresas", "/profissoes", "/reality-check", "/sobre", "/termos", "/privacidade"].map(path => ({ url: `${base}${path}`, changeFrequency: path === "" ? "daily" : "weekly", priority: path === "" ? 1 : .7 }));
}
