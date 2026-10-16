"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Collapses the dashboard navigation behind a "Menu" button on small screens and marks the current page.
export function DashboardNavToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll("a").forEach((link) => {
      if (link.getAttribute("href") === pathname) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, [pathname]);
  return <>
    <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="dashboard-nav" onClick={() => setOpen((value) => !value)}>{open ? "Fechar" : "Menu"}</button>
    <div id="dashboard-nav" ref={ref} className="side-nav-wrap" data-open={open} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</div>
  </>;
}
