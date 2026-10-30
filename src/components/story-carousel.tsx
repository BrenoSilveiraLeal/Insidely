"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

// Home page: what customers decided after a conversation, one at a time. Advances every few
// seconds, pauses while hovered or focused, and stays still for people who prefer less motion.
export function StoryCarousel({ stories }: { stories: { bookingId: string; story: string }[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = stories.length;
  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), 6500);
    return () => clearInterval(timer);
  }, [count, paused]);
  if (!count) return null;
  const go = (step: number) => setIndex((value) => (value + step + count) % count);
  return <div className="story-carousel" aria-roledescription="carrossel" aria-label="Depois da conversa" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <div className="story-carousel-track" aria-live={paused ? "polite" : "off"}>
      {stories.map((item, position) => <figure key={item.bookingId} className={`story-slide${position === index ? " is-active" : ""}`} aria-hidden={position !== index} aria-roledescription="slide" aria-label={`${position + 1} de ${count}`}>
        <blockquote>“{item.story}”</blockquote>
        <figcaption>Cliente da Insidely, depois da conversa</figcaption>
      </figure>)}
    </div>
    {count > 1 && <div className="story-carousel-controls">
      <button type="button" onClick={() => go(-1)} aria-label="História anterior"><ChevronLeft size={16}/></button>
      <div className="story-carousel-dots">{stories.map((item, position) => <button type="button" key={item.bookingId} className={position === index ? "is-active" : undefined} aria-label={`Ir para a história ${position + 1}`} aria-current={position === index || undefined} onClick={() => setIndex(position)}/>)}</div>
      <button type="button" onClick={() => go(1)} aria-label="Próxima história"><ChevronRight size={16}/></button>
    </div>}
  </div>;
}
