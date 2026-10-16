"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Collapses the dashboard navigation behind a "Menu" button on small screens and marks the current page.
export function DashboardNavToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const links = [...(ref.current?.querySelectorAll("a") ?? [])];
    const exact = links.filter((link) => link.getAttribute("href")?.split("?")[0] === pathname);
    const active = exact.length ? exact : links.filter((link) => {
      const href = link.getAttribute("href")?.split("?")[0];
      return Boolean(href && href !== "/" && pathname.startsWith(`${href}/`));
    }).sort((a, b) => (b.getAttribute("href")?.length ?? 0) - (a.getAttribute("href")?.length ?? 0)).slice(0, 1);
    links.forEach((link) => {
      if (active.includes(link)) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, [pathname]);
  return <>
    <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="dashboard-nav" onClick={() => setOpen((value) => !value)}>{open ? "Fechar" : "Menu"}</button>
    <div id="dashboard-nav" ref={ref} className="side-nav-wrap" data-open={open} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</div>
  </>;
}
