"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

type Mode = "user" | "consultant";
type StaffMode = "admin" | "support";

// Last sidebar mode the person saw, so a loading screen keeps the same menu instead of
// flashing the client one while a consultant page loads.
let lastMode: Mode | null = null;
let lastStaffMode: StaffMode | null = null;

export function RememberDashboardMode({ mode }: { mode: Mode | "admin" | "support" }) {
  useEffect(() => {
    if (mode === "admin" || mode === "support") {
      // Staff panels remember which menu they use, so their loading screen shows the same one (lib/dashboard-mode.ts).
      lastStaffMode = mode;
      document.cookie = `insidely-staff-mode=${mode}; path=/; max-age=31536000; samesite=lax`;
      return;
    }
    lastMode = mode;
    // Also remembered for the server (lib/dashboard-mode.ts), so shared pages keep this menu.
    document.cookie = `insidely-mode=${mode}; path=/; max-age=31536000; samesite=lax`;
  }, [mode]);
  return null;
}

// "context" pages (/dashboard/... ?context=consultant) say their mode in the URL; others reuse the last one.
// `initial` is the menu from the cookie, used until the browser has its own memory (first load, reload),
// so the loading screen never shows a different menu than the page it stands in for.
export function SkeletonForMode({ initial, user, consultant, useContext = false }: { initial: Mode; user: React.ReactNode; consultant: React.ReactNode; useContext?: boolean }) {
  const params = useSearchParams();
  const mode = useContext ? (params.get("context") === "consultant" ? "consultant" : "user") : lastMode ?? initial;
  return mode === "consultant" ? consultant : user;
}

// Staff loading screen: the admin or support menu the person was using.
export function SkeletonForStaff({ initial, admin, support }: { initial: StaffMode; admin: React.ReactNode; support: React.ReactNode }) {
  return (lastStaffMode ?? initial) === "support" ? support : admin;
}
