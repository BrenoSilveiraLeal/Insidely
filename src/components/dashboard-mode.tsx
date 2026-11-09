"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

type PanelMode = "user" | "consultant" | "admin" | "support";

// Remembered for the server: lib/dashboard-mode.ts (shared pages keep the consultant/client menu) and the
// loading screen of a full page load (the panel menu last shown, `insidely-panel`).
export function RememberDashboardMode({ mode, canConsultant = false }: { mode: PanelMode; canConsultant?: boolean }) {
  useEffect(() => {
    const year = "path=/; max-age=31536000; samesite=lax";
    document.cookie = `insidely-panel=${mode}${mode === "user" && canConsultant ? "-c" : ""}; ${year}`;
    if (mode === "user" || mode === "consultant") document.cookie = `insidely-mode=${mode}; ${year}`;
  }, [mode, canConsultant]);
  return null;
}

/* The sidebar on screen, copied as it looks. While the next page loads, its loading screen shows this
   exact copy, so the menu never switches (not even for a moment) to another panel's menu. Signing in
   and out are full page loads, which clear it. */
type Snapshot = { sidebar: string; eyebrow: string; bell: string };
let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

function capture(shell: HTMLElement) {
  const aside = shell.querySelector<HTMLElement>("aside.sidebar");
  if (!aside) return;
  const copy = aside.cloneNode(true) as HTMLElement;
  // A phone menu opened to pick a page shows closed while that page loads.
  copy.querySelector("#dashboard-nav")?.setAttribute("data-open", "false");
  const toggle = copy.querySelector(".nav-toggle");
  if (toggle) { toggle.setAttribute("aria-expanded", "false"); toggle.textContent = "Menu"; }
  const top = shell.querySelector(".dash-top");
  snapshot = { sidebar: copy.innerHTML, eyebrow: top?.querySelector(".eyebrow")?.textContent ?? "", bell: top?.lastElementChild?.outerHTML ?? "" };
  listeners.forEach((listener) => listener());
}

export function SidebarMemory() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const shell = marker.current?.closest<HTMLElement>(".dash");
    if (!shell) return;
    capture(shell);
    // Again right before a menu link is followed: badges and the marked item are current then.
    const onPress = () => capture(shell);
    shell.addEventListener("pointerdown", onPress, true);
    shell.addEventListener("keydown", onPress, true);
    return () => { shell.removeEventListener("pointerdown", onPress, true); shell.removeEventListener("keydown", onPress, true); };
  }, []);
  return <span ref={marker} hidden />;
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

function markCurrent(nav: HTMLElement, pathname: string) {
  const links = [...nav.querySelectorAll("a")];
  const path = (link: Element) => link.getAttribute("href")?.split("?")[0] ?? "";
  const exact = links.filter((link) => path(link) === pathname);
  const active = exact.length ? exact : links.filter((link) => path(link) !== "/" && pathname.startsWith(`${path(link)}/`)).sort((a, b) => path(b).length - path(a).length).slice(0, 1);
  links.forEach((link) => active.includes(link) ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current"));
}

/** Loading screen frame: the remembered sidebar when there is one, otherwise the server's best guess (`fallback`). */
export function PanelLoading({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  const remembered = useSyncExternalStore(subscribe, () => snapshot, () => null);
  const pathname = usePathname();
  const router = useRouter();
  const aside = useRef<HTMLElement>(null);
  useEffect(() => { if (aside.current) markCurrent(aside.current, pathname); }, [pathname, remembered]);
  if (!remembered) return fallback;
  // The copy is plain HTML: in-app links still navigate inside the app instead of reloading the page.
  const follow = (event: React.MouseEvent) => {
    const link = (event.target as HTMLElement).closest("a");
    const href = link?.getAttribute("href");
    if (!href?.startsWith("/") || link?.target || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    router.push(href);
  };
  return <main className="dash"><div className="dash-shell">
    <aside ref={aside} className="sidebar" onClick={follow} dangerouslySetInnerHTML={{ __html: remembered.sidebar }} />
    <section className="dash-main"><div className="dash-top"><div><span className="eyebrow">{remembered.eyebrow}</span><h1 className="dash-title"></h1></div><div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: remembered.bell }} /></div>{children}</section>
  </div></main>;
}
