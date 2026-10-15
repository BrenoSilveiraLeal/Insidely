"use client";

import { useLayoutEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const steps = [
  { number: "01", eyebrow: "Explore", title: "Encontre o contexto certo.", copy: "Filtre por profissão, empresa, senioridade e forma de trabalho.", symbol: "?" },
  { number: "02", eyebrow: "Pergunte", title: "Leve as perguntas difíceis.", copy: "Rotina, liderança, carga, crescimento e processo seletivo - sem pedir dados confidenciais.", symbol: "?" },
  { number: "03", eyebrow: "Decida", title: "Troque suposição por clareza.", copy: "Use experiências contextualizadas para escolher seu próximo passo com mais consciência.", symbol: "?" },
];

export function StoryMotion() {
  const scope = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    if (reduced || !scope.current) return;

    gsap.registerPlugin(ScrollTrigger);
    let removeResizeListener: (() => void) | undefined;
    const context = gsap.context(() => {
      const stack = scope.current?.querySelector<HTMLElement>(".story-stack");
      const cards = gsap.utils.toArray<HTMLElement>(".story-card");
      if (!stack || cards.length < 3) return;

      const offset = () => Number.parseFloat(getComputedStyle(stack).getPropertyValue("--story-offset")) || 150;
      const peek = () => Number.parseFloat(getComputedStyle(stack).getPropertyValue("--story-peek")) || 34;
      const startingY = (index: number) => index === 0 ? 0 : cards[index].offsetHeight + (index === 2 ? offset() : 0);
      cards.forEach((card, index) => gsap.set(card, { y: startingY(index), zIndex: index === 2 ? 1 : index === 1 ? cards.length + 1 : cards.length }));

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: stack,
          start: "top top+=105",
          end: "bottom bottom-=105",
          scrub: 0.65,
          invalidateOnRefresh: true,
        },
      });
      timeline
        .to(cards[1], { y: () => peek(), duration: 1, ease: "none" }, 0)
        .set(cards[2], { zIndex: cards.length + 2 }, 1)
        .to(cards[2], { y: () => peek() * 2, duration: 1, ease: "none" }, 1);

      const refreshStack = () => {
        cards.forEach((card, index) => gsap.set(card, { y: startingY(index) }));
        ScrollTrigger.refresh();
      };
      window.addEventListener("resize", refreshStack);
      removeResizeListener = () => window.removeEventListener("resize", refreshStack);
      ScrollTrigger.refresh();
    }, scope);

    return () => {
      removeResizeListener?.();
      context.revert();
    };
  }, [reduced]);

  return (
    <section className="story" id="como-funciona" ref={scope}>
      <div className="container">
        <motion.div
          className="story-intro"
          initial={reduced ? false : { opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.75 }}
        >
          <span className="eyebrow">Uma escolha menos escura</span>
          <h2>Não aceite uma descrição. Investigue o contexto.</h2>
          <p className="section-copy">A Insidely aproxima dúvidas honestas de experiências verificadas - com proteção para quem pergunta e para quem responde.</p>
        </motion.div>
        <div className="story-stack">
          <div className="story-stage">
            {steps.map((step) => (
              <article className="story-card" key={step.number}>
                <div className="story-number">{step.number}</div>
                <div>
                  <span className="eyebrow">{step.eyebrow}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
                <div className="story-symbol">{step.symbol}</div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
