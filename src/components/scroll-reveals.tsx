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
      const questionList = scope.current?.querySelector<HTMLElement>(".question-list");
      if (questionList) {
        gsap.from(questionList.querySelectorAll("article"), {
          autoAlpha: 0,
          x: 42,
          duration: .7,
          stagger: .14,
          ease: "power3.out",
          scrollTrigger: { trigger: questionList, start: "top 78%", once: true },
        });
      }

      const trustSection = scope.current?.querySelector<HTMLElement>(".trust-section");
      if (trustSection) {
        const trustTimeline = gsap.timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: trustSection, start: "top 72%", once: true },
        });
        trustTimeline
          .from(trustSection.querySelector(".trust-grid > div:first-child"), { autoAlpha: 0, x: -44, duration: .78 })
          .from(trustSection.querySelectorAll(".trust-card"), { autoAlpha: 0, x: 46, y: 16, duration: .62, stagger: .16 }, "-=.42");
      }

      const finalCta = scope.current?.querySelector<HTMLElement>(".final-cta");
      if (finalCta) {
        const finalTimeline = gsap.timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: finalCta, start: "top 74%", once: true },
        });
        finalTimeline
          .from(finalCta.querySelectorAll(".final-copy > *"), { autoAlpha: 0, y: 38, duration: .64, stagger: .12 })
          .from(finalCta.querySelector(".final-symbol"), { autoAlpha: 0, x: 62, scale: .88, duration: .82 }, "-=.56");
      }

      reveal(".people-section .section-head, .company-section .section-head, .profession-section .section-head", { y: 26, duration: .62 });
      reveal(".professional-card, .company-card, .profession-card", { y: 38, duration: .68 });
    }, scope);

    return () => context.revert();
  }, [reduced]);

  return <div ref={scope}>{children}</div>;
}
