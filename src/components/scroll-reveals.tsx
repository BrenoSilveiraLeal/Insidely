"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function ScrollReveals({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    if (reduced || !scope.current) return;
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      const reveal = (selector: string, options: gsap.TweenVars = {}) => {
        gsap.utils.toArray<HTMLElement>(selector).forEach((element) => {
          gsap.from(element, {
            autoAlpha: 0,
            y: 34,
            duration: .72,
            ease: "power3.out",
            scrollTrigger: { trigger: element, start: "top 86%", once: true },
            ...options,
          });
        });
      };

      reveal(".problem-heading, .story-intro, .brand-truth-inner blockquote, .truth-heading, .trust-grid > div:first-child, .reviews-grid > div, .final-copy", { y: 44, duration: .82 });
      reveal(".question-list article, .trust-card", { x: 28, y: 0, duration: .6 });
      reveal(".people-section .section-head, .company-section .section-head, .profession-section .section-head", { y: 26, duration: .62 });
      reveal(".professional-card, .company-card, .profession-card", { y: 26, duration: .56 });
      reveal(".brand-truth-inner > .eyebrow, .brand-truth-inner > .button", { y: 22, duration: .55 });
      reveal(".final-symbol", { scale: .9, y: 28, duration: .78 });
    }, scope);

    return () => context.revert();
  }, [reduced]);

  return <div ref={scope}>{children}</div>;
}
