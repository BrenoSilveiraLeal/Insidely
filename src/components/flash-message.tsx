"use client";

import { useEffect, useState } from "react";

// Confirmation shown after an action: fades out after a few seconds and drops its query flag
// from the URL, so a reload or the back button doesn't show it again.
export function FlashMessage({ children, param = "ok", duration = 5000 }: { children: React.ReactNode; param?: string; duration?: number }) {
  const [phase, setPhase] = useState<"shown" | "leaving" | "gone">("shown");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) { url.searchParams.delete(param); window.history.replaceState(window.history.state, "", url); }
    const leave = setTimeout(() => setPhase("leaving"), duration);
    const remove = setTimeout(() => setPhase("gone"), duration + 400);
    return () => { clearTimeout(leave); clearTimeout(remove); };
  }, [param, duration]);
  if (phase === "gone") return null;
  return <p className={`form-feedback flash-message${phase === "leaving" ? " is-leaving" : ""}`} role="status">{children}</p>;
}
