"use client";

import { useState } from "react";

// Ideas of what to ask, shown as small chips. Clicking one adds a starter question about that topic
// (and records the topic for the consultant); clicking again removes it. With one target the starter
// is added to that box; with several (one question per field) it fills the next empty, enabled field.
// Nothing here is required.
const STARTERS: Record<string, string> = {
  "rotina real": "Como é um dia comum de trabalho por aí?",
  "cultura da equipe": "Como é o clima e a forma de trabalhar do time?",
  "processo seletivo": "Como funciona o processo seletivo e o que mais pesa?",
  "crescimento": "Como é o crescimento e a progressão de carreira?",
  "carga de trabalho": "Como é a carga de trabalho e o equilíbrio com a vida pessoal?",
};

export function TopicIdeas({ topics, targetId, targetIds }: { topics: string[]; targetId?: string; targetIds?: string[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const starterOf = (topic: string) => STARTERS[topic.toLocaleLowerCase("pt-BR")] ?? `Quero entender melhor: ${topic.toLocaleLowerCase("pt-BR")}.`;
  const boxes = () => (targetIds ?? (targetId ? [targetId] : [])).map((id) => document.getElementById(id) as HTMLTextAreaElement | null).filter((box): box is HTMLTextAreaElement => Boolean(box));
  const toggle = (topic: string) => {
    const on = !picked.includes(topic);
    const starter = starterOf(topic);
    if (targetIds) {
      if (on) {
        const empty = boxes().find((box) => !box.disabled && !box.value.trim());
        if (!empty) return;
        empty.value = starter;
        empty.focus();
      } else {
        const filled = boxes().find((box) => box.value.trim() === starter);
        if (filled) filled.value = "";
      }
    } else {
      const box = boxes()[0];
      if (box && on && !box.value.includes(starter)) { box.value = box.value.trim() ? `${box.value.trim()}\n${starter} ` : `${starter} `; box.focus(); }
    }
    setPicked((list) => on ? [...list, topic] : list.filter((item) => item !== topic));
  };
  if (!topics.length) return null;
  return <div className="topic-ideas">
    <span className="topic-ideas-label">{targetIds ? "Ideias de perguntas: cada uma preenche o próximo campo vazio" : "Ideias do que perguntar"}</span>
    <div className="topic-ideas-list">{topics.map((topic) => <button type="button" key={topic} className={`topic-idea${picked.includes(topic) ? " is-picked" : ""}`} aria-pressed={picked.includes(topic)} onClick={() => toggle(topic)}>{picked.includes(topic) ? "✓" : "+"} {topic.charAt(0).toUpperCase() + topic.slice(1)}</button>)}</div>
    {picked.map((topic) => <input key={topic} type="hidden" name="topics" value={topic}/>)}
  </div>;
}
