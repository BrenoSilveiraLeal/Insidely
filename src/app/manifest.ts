import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Insidely",
    short_name: "Insidely",
    description: "Converse com profissionais verificados antes de escolher uma empresa ou profissão.",
    start_url: "/",
    display: "standalone",
    background_color: "#172033",
    theme_color: "#172033",
    lang: "pt-BR",
    icons: [{ src: "/insidely-oauth-logo.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
