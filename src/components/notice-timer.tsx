"use client";

import { useEffect } from "react";

// Every confirmation or error box on the site (form-feedback, form-success, success-box, form-error)
// fades out a few seconds after it appears and the page goes back to how it was. A box whose text
// changes, or that appears again, starts over. Add data-persist to a box that must stay.
const NOTICE = ".form-feedback, .form-success, .success-box, .form-error";
const SHOWN_MS = 5000, ERROR_MS = 9000, FADE_MS = 400;

export function NoticeTimer() {
  useEffect(() => {
    const timers = new WeakMap<HTMLElement, number[]>();
    const schedule = (notice: HTMLElement) => {
      if (notice.dataset.persist !== undefined || notice.closest("[data-persist]")) return;
      for (const timer of timers.get(notice) ?? []) window.clearTimeout(timer);
      notice.hidden = false;
      notice.classList.remove("notice-leaving");
      const wait = notice.matches(".form-error") ? ERROR_MS : SHOWN_MS;
      timers.set(notice, [
        window.setTimeout(() => notice.classList.add("notice-leaving"), wait),
        window.setTimeout(() => { notice.hidden = true; notice.classList.remove("notice-leaving"); }, wait + FADE_MS),
      ]);
    };
    const scan = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(NOTICE)) schedule(root);
      root.querySelectorAll?.<HTMLElement>(NOTICE).forEach(schedule);
    };
    scan(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) if (node instanceof HTMLElement) scan(node);
        // New text inside an existing box (same message element, new result): show it again.
        const target = mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement;
        const notice = target?.closest<HTMLElement>(NOTICE);
        if (notice && (mutation.type === "characterData" || mutation.type === "childList")) schedule(notice);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
