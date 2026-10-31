"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const seen = new Set<string>();

// Each server render of a panel page carries its own renderId. Seeing one again means the page came
// from the browser's router cache (the back button, or a revisit within staleTimes), so its menu
// counts and statuses may be old: it shows at once and is refreshed from the server right after.
export function RefreshStalePage({ renderId }: { renderId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (seen.has(renderId)) router.refresh();
    seen.add(renderId);
  }, [renderId, router]);
  return null;
}
