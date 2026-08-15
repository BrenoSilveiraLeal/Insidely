import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/favicon.png", shortcut: "/favicon.png", apple: "/favicon.png" },
  title: { default: "Insidely - A realidade antes da decis", template: "%s ? Insidely" },
  description: "Converse com profissionais verificados antes de escolher uma empresa ou profiss.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body suppressHydrationWarning>{children}</body></html>;
}
