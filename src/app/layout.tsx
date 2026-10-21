import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";

// Self-hosted at build time: every device gets the same type, with no request to Google at runtime.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://insidely.vercel.app"),
  icons: { icon: "/favicon.png", shortcut: "/favicon.png", apple: "/favicon.png" },
  verification: { google: "s_ssjV-gKDczz7Zqva6a9LHHSNO88KBL5aLpQQVvuFc" },
  title: { default: "Insidely — A realidade antes da decisão", template: "%s | Insidely" },
  description: "Converse com profissionais verificados antes de escolher uma empresa ou profissão.",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Insidely", title: "Insidely — A realidade antes da decisão", description: "Conheça a realidade de empresas e profissões antes de decidir." },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#172033",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={`${inter.variable} ${nunito.variable}`}><body suppressHydrationWarning><Suspense fallback={null}><NavigationProgress /></Suspense>{children}<Analytics /><SpeedInsights /></body></html>;
}
