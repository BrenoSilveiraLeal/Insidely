"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const NOTICES = ".dash-main > .form-feedback, .dash-main > .success-box, .dash-main > .form-success, .dash-main > .form-error, .dash-main > .consultas-feedback";

// Page-level notices (the ones a redirect shows above the content) fade out after a few seconds,
// so the page goes back to its normal layout. Errors stay a little longer than confirmations.
export function AutoDismissNotices() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const timers: number[] = [];
    document.querySelectorAll<HTMLElement>(NOTICES).forEach((notice) => {
      if (notice.dataset.dismissing) return;
      notice.dataset.dismissing = "1";
      const delay = notice.matches(".form-error") ? 9000 : 5000;
      timers.push(window.setTimeout(() => notice.classList.add("notice-leaving"), delay));
      timers.push(window.setTimeout(() => { notice.hidden = true; }, delay + 400));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pathname, params]);
  return null;
}
