"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

type Mode = "user" | "consultant";

// Last sidebar mode the person saw, so a loading screen keeps the same menu instead of
// flashing the client one while a consultant page loads.
let lastMode: Mode | null = null;

export function RememberDashboardMode({ mode }: { mode: Mode | "admin" | "support" }) {
  useEffect(() => {
    if (mode === "admin" || mode === "support") return;
    lastMode = mode;
    // Also remembered for the server (lib/dashboard-mode.ts), so shared pages keep this menu.
    document.cookie = `insidely-mode=${mode}; path=/; max-age=31536000; samesite=lax`;
  }, [mode]);
  return null;
}

// "context" pages (/dashboard/... ?context=consultant) say their mode in the URL; others reuse the last one.
export function SkeletonForMode({ user, consultant, useContext = false }: { user: React.ReactNode; consultant: React.ReactNode; useContext?: boolean }) {
  const params = useSearchParams();
  const mode = useContext ? (params.get("context") === "consultant" ? "consultant" : "user") : lastMode ?? "user";
  return mode === "consultant" ? consultant : user;
}
