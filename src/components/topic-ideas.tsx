"use client";

import { useState } from "react";

// Ideas of what to ask, shown as small chips under the "what do you need to decide" box. Clicking
// one adds a starter question about that topic to the text (and records the topic for the
// consultant); clicking again removes the topic. Nothing here is required.
const STARTERS: Record<string, string> = {
  "rotina real": "Como é um dia comum de trabalho por aí?",
  "cultura da equipe": "Como é o clima e a forma de trabalhar do time?",
  "processo seletivo": "Como funciona o processo seletivo e o que mais pesa?",
  "crescimento": "Como é o crescimento e a progressão de carreira?",
  "carga de trabalho": "Como é a carga de trabalho e o equilíbrio com a vida pessoal?",
};

export function TopicIdeas({ topics, targetId }: { topics: string[]; targetId: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (topic: string) => {
    const on = !picked.includes(topic);
    setPicked((list) => on ? [...list, topic] : list.filter((item) => item !== topic));
    const box = document.getElementById(targetId) as HTMLTextAreaElement | null;
    if (!box || !on) return;
    const starter = STARTERS[topic.toLocaleLowerCase("pt-BR")] ?? `Quero entender melhor: ${topic.toLocaleLowerCase("pt-BR")}.`;
    if (!box.value.includes(starter)) box.value = box.value.trim() ? `${box.value.trim()}\n${starter} ` : `${starter} `;
    box.focus();
  };
  if (!topics.length) return null;
  return <div className="topic-ideas">
    <span className="topic-ideas-label">Ideias do que perguntar</span>
    <div className="topic-ideas-list">{topics.map((topic) => <button type="button" key={topic} className={`topic-idea${picked.includes(topic) ? " is-picked" : ""}`} aria-pressed={picked.includes(topic)} onClick={() => toggle(topic)}>{picked.includes(topic) ? "✓" : "+"} {topic.charAt(0).toUpperCase() + topic.slice(1)}</button>)}</div>
    {picked.map((topic) => <input key={topic} type="hidden" name="topics" value={topic}/>)}
  </div>;
}
