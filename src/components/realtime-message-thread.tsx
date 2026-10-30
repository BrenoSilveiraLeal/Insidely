"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Message = { id: string; body: string; senderId: string };

// The consultant's messages sit on the right in orange and the customer's on the left, the same way
// for both participants, so it is always clear who said what.
export function RealtimeMessageThread({ conversationId, currentUserId, consultantId, otherName, initialMessages }: { conversationId: string; currentUserId: string; consultantId: string; otherName: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    // Row-level security filters realtime events by the subscriber, so the socket must carry the
    // signed-in user's token before subscribing; otherwise no message is ever delivered.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase.channel(`conversation:${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "Message", filter: `conversationId=eq.${conversationId}` }, (payload) => {
        const row = payload.new as Message;
        setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, row]);
      }).subscribe();
    });
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
  }, [conversationId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  return <div className="message-thread conversation-thread" aria-live="polite">
    {messages.map((message) => {
      const fromConsultant = message.senderId === consultantId;
      return <div key={message.id} className={`message ${fromConsultant ? "message-consultant" : "message-customer"}`}>
        <small>{message.senderId === currentUserId ? "Você" : otherName}</small>
        <span>{message.body}</span>
      </div>;
    })}
    {!messages.length && <p className="muted conversation-empty">Nenhuma mensagem ainda. Use este espaço para alinhar os detalhes da conversa.</p>}
    <div ref={end}/>
  </div>;
}
