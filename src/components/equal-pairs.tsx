"use client";
import { useEffect, useRef } from "react";

// For the masonry TwoColumns: the two cards of each pair (left/right, same position) get the height
// of the taller one while closed, so they line up. A card with an open <details> grows alone: its
// partner keeps the closed height, and the columns stay independent. Off on one-column screens.
export function EqualPairs() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const container = marker.current?.parentElement;
    if (!container) return;
    const closedHeight = new WeakMap<HTMLElement, number>();
    let frame = 0;
    const cards = () => [...container.querySelectorAll<HTMLElement>(".two-columns-item")]
      .sort((a, b) => Number(a.style.order) - Number(b.style.order))
      .map((item) => item.firstElementChild as HTMLElement | null);
    const update = () => {
      const list = cards();
      const twoColumns = getComputedStyle(container).gridTemplateColumns.split(" ").length > 1;
      for (const card of list) {
        if (!card) continue;
        card.style.minHeight = "";
        // A card's own height is measured only while nothing in it is open.
        if (!card.querySelector("details[open]")) closedHeight.set(card, card.offsetHeight);
      }
      if (!twoColumns) return;
      for (let index = 0; index < list.length; index += 2) {
        const pair = [list[index], list[index + 1]].filter((card): card is HTMLElement => Boolean(card));
        if (pair.length < 2) continue;
        const height = Math.max(...pair.map((card) => closedHeight.get(card) ?? 0));
        for (const card of pair) card.style.minHeight = `${height}px`;
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule();
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    container.addEventListener("toggle", schedule, true);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); container.removeEventListener("toggle", schedule, true); };
  }, []);
  return <span ref={marker} hidden/>;
}
