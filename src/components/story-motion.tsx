"use client";

import { useLayoutEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const steps = [
  { number: "01", eyebrow: "Explore", title: "Encontre o contexto certo.", copy: "Filtre por profissão, empresa, senioridade e forma de trabalho.", symbol: "⌕" },
  { number: "02", eyebrow: "Pergunte", title: "Leve as perguntas difíceis.", copy: "Rotina, liderança, carga, crescimento e processo seletivo — sem pedir dados confidenciais.", symbol: "?" },
  { number: "03", eyebrow: "Decida", title: "Troque suposição por clareza.", copy: "Use experiências contextualizadas para escolher seu próximo passo com mais consciência.", symbol: "→" },
];

export function StoryMotion() {
  const scope = useRef<HTMLElement>(null); const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (reduced || !scope.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".story-card").forEach((card, index) => {
        gsap.fromTo(card, { rotate: index % 2 ? 1.5 : -1.5, scale: .965 }, { rotate: 0, scale: 1, ease: "none", scrollTrigger: { trigger: card, start: "top 82%", end: "top 30%", scrub: .7 } });
      });
    }, scope);
    return () => context.revert();
  }, [reduced]);
  return <section className="story" id="como-funciona" ref={scope}><div className="container"><motion.div className="story-intro" initial={reduced ? false : { opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }} transition={{ duration: .75 }}><span className="eyebrow">Uma escolha menos escura</span><h2>Não aceite uma descrição. Investigue o contexto.</h2><p className="section-copy">A Insidely aproxima dúvidas honestas de experiências verificadas — com proteção para quem pergunta e para quem responde.</p></motion.div><div className="story-stack">{steps.map((step)=><article className="story-card" key={step.number}><div className="story-number">{step.number}</div><div><span className="eyebrow">{step.eyebrow}</span><h3>{step.title}</h3><p>{step.copy}</p></div><div className="story-symbol">{step.symbol}</div></article>)}</div></div></section>;
}

