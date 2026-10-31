"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

// Copies a link (the room address) instead of printing the long URL on the page.
export function CopyLinkButton({ href, label = "Copiar link" }: { href: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="button button-ghost button-sm" onClick={async () => {
    const url = href.startsWith("http") ? href : `${window.location.origin}${href}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { window.prompt("Copie o link:", url); }
  }}>{copied ? <Check size={15} aria-hidden="true"/> : <Link2 size={15} aria-hidden="true"/>}{copied ? "Link copiado" : label}</button>;
}
