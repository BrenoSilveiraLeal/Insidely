"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/error-screen";

// Replaces the root layout when it fails, so it brings its own <html> and <body>.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="pt-BR"><body><title>Instabilidade temporária · Insidely</title><ErrorScreen digest={error.digest} retry={retry} message={`${error.name}: ${error.message}`}/></body></html>;
}
