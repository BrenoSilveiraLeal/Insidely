"use client";
/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { ArrowDown, ArrowRight, Eye, LockKeyhole, MessageCircleMore } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function InsideHero() {
  const scope = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (reduced || !scope.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline.from(".hero-kicker", { y: 18, opacity: 0, duration: 0.45 }).from(".hero-line", { y: 54, opacity: 0, duration: 0.62, stagger: 0.08 }, "-=.18").from(".inside-hero-copy", { y: 24, opacity: 0, duration: 0.5 }, "-=.28").from(".inside-hero-actions", { opacity: 0, duration: 0.5 }, "-=.28").from(".inside-scene", { x: 45, opacity: 0, rotate: 2, duration: 0.7 }, "-=.45");
      gsap.to(".surface-card", { yPercent: -22, rotate: -2, ease: "none", scrollTrigger: { trigger: scope.current, start: "top top", end: "bottom top", scrub: 0.7 } });
      gsap.to(".inside-card", { yPercent: -7, rotate: 1, ease: "none", scrollTrigger: { trigger: scope.current, start: "top top", end: "bottom top", scrub: 0.7 } });
    }, scope);
    return () => context.revert();
  }, [reduced]);
  return <section className="inside-hero" id="inicio" ref={scope}><div className="inside-hero-grid container"><div className="inside-hero-content"><span className="eyebrow hero-kicker">Carreira sem propaganda</span><h1><span className="hero-line">A vaga <span className="hero-word-outline">mostra</span></span><span className="hero-line">o cargo.</span><span className="hero-line hero-line-accent">A gente mostra</span><span className="hero-line hero-line-accent">o que há por</span><span className="hero-line hero-line-accent">dentro.</span></h1><p className="inside-hero-copy">Converse com quem vive a rotina antes de aceitar a vaga, escolher o curso ou mudar de carreira.</p><div className="inside-hero-actions"><a className="button button-accent" href="/buscar">Encontrar alguém <ArrowRight size={17}/></a><Link className="button button-ghost" href="#como-funciona">Ver como funciona <ArrowDown size={17}/></Link></div></div><div className="inside-scene"><article className="inside-card"><span className="scene-label"><Eye size={15}/> Quem vive conta</span><h2>"A comunicação falha. O cargo vira três. A prioridade muda sem contexto."</h2><div className="reality-points"><span><MessageCircleMore size={14}/> comunicação</span><span><ArrowRight size={14}/> desvio de função</span><span><LockKeyhole size={14}/> cobrança sem clareza</span></div></article><article className="surface-card"><span className="scene-label">O anúncio diz</span><h2>Ambiente dinâmico, autonomia e grandes oportunidades de crescimento.</h2><div className="surface-lines"><i/><i/><i/></div></article></div></div></section>;
}
