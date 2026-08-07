import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Insidely — A realidade antes da decisão", template: "%s · Insidely" },
  description: "Converse com profissionais verificados antes de escolher uma empresa ou profissão.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

