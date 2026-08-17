import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://insidely.vercel.app"),
  icons: { icon: "/favicon.png", shortcut: "/favicon.png", apple: "/favicon.png" },
  title: { default: "Insidely — A realidade antes da decisão", template: "%s | Insidely" },
  description: "Converse com profissionais verificados antes de escolher uma empresa ou profissão.",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Insidely", title: "Insidely — A realidade antes da decisão", description: "Conheça a realidade de empresas e profissões antes de decidir." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body suppressHydrationWarning>{children}</body></html>;
}
