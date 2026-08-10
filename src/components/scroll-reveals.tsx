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
            scrollTrigger: {
              trigger: element,
              start: "top 86%",
              once: true,
              invalidateOnRefresh: true,
            },
            ...options,
          });
        });
      };

      // O hero e "como funciona" têm movimento próprio. As entradas abaixo ficam
      // reservadas aos pontos em que ajudam a guiar a leitura, sem animar a página toda.
      reveal(".problem-heading", { y: 52, duration: .84 });
      reveal(".question-list article", { x: 42, y: 0, duration: .7 });
      reveal(".people-section .section-head, .company-section .section-head, .profession-section .section-head", { y: 26, duration: .62 });
      reveal(".professional-card, .company-card, .profession-card", { y: 38, duration: .68 });
    }, scope);

    return () => context.revert();
  }, [reduced]);

  return <div ref={scope}>{children}</div>;
}
