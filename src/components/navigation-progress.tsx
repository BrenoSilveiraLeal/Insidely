"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Thin bar at the top that starts on the click itself, so every navigation gets instant feedback. */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    // The route changed: finish the bar, then hide it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the router's new location
    setState((current) => current === "loading" ? "done" : current);
    const timeout = window.setTimeout(() => setState((current) => current === "done" ? "idle" : current), 350);
    return () => window.clearTimeout(timeout);
  }, [pathname, searchParams]);

  useEffect(() => {
    // A navigation that never lands (cancelled, same page) must not leave the bar hanging.
    if (state !== "loading") return;
    const timeout = window.setTimeout(() => setState("idle"), 12000);
    return () => window.clearTimeout(timeout);
  }, [state]);

  return <div className="nav-progress" data-state={state} aria-hidden="true" />;
}
