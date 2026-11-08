"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Collapses the dashboard navigation behind a "Menu" button on small screens and marks the current page
// (activeHref when the page names the item it belongs to).
export function DashboardNavToggle({ children, activeHref }: { children: React.ReactNode; activeHref?: string }) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 950px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const links = [...(ref.current?.querySelectorAll("a") ?? [])];
    const current = activeHref ?? pathname;
    const exact = links.filter((link) => link.getAttribute("href")?.split("?")[0] === current);
    const active = exact.length ? exact : links.filter((link) => {
      const href = link.getAttribute("href")?.split("?")[0];
      return Boolean(href && href !== "/" && current.startsWith(`${href}/`));
    }).sort((a, b) => (b.getAttribute("href")?.length ?? 0) - (a.getAttribute("href")?.length ?? 0)).slice(0, 1);
    links.forEach((link) => {
      if (active.includes(link)) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, [pathname, activeHref]);
  return <>
    <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="dashboard-nav" onClick={() => setOpen((value) => !value)}>{open ? "Fechar" : "Menu"}</button>
    <div id="dashboard-nav" ref={ref} className="side-nav-wrap" data-open={open} aria-hidden={compact && !open ? true : undefined} inert={compact && !open} onClick={(event) => { if (event.target === event.currentTarget || (event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</div>
  </>;
}
