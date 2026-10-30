"use client";

import { useEffect, useRef, useState } from "react";
import { markConversationReadAction } from "@/app/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Message = { id: string; body: string; senderId: string; createdAt: string; readAt: string | null };

// Database timestamps come without a time zone and are UTC.
function messageTime(value: string) {
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  const zone = "America/Sao_Paulo";
  const day = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, dateStyle: "short" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(date);
  return day(date) === day(new Date()) ? time : `${day(date).slice(0, 5)} ${time}`;
}

// The consultant's messages sit on the right in orange and the customer's on the left, the same way
// for both participants. Own messages show "Enviada" or "Lida às HH:MM", updated live: the other
// side's page marks messages read (markConversationReadAction) and realtime delivers the UPDATE.
export function RealtimeMessageThread({ bookingId, conversationId, currentUserId, consultantId, otherName, initialMessages }: { bookingId: string; conversationId: string; currentUserId: string; consultantId: string; otherName: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const markRead = () => { if (document.visibilityState === "visible") void markConversationReadAction(bookingId).catch(() => undefined); };
    // Row-level security filters realtime events by the subscriber, so the socket must carry the
    // signed-in user's token before subscribing; otherwise no message is ever delivered.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase.channel(`conversation:${conversationId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "Message", filter: `conversationId=eq.${conversationId}` }, (payload) => {
          const row = payload.new as Message;
          setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, row]);
          if (row.senderId !== currentUserId) markRead();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "Message", filter: `conversationId=eq.${conversationId}` }, (payload) => {
          const row = payload.new as Message;
          setMessages((current) => current.map((item) => item.id === row.id ? { ...item, readAt: row.readAt } : item));
        })
        .subscribe();
    });
    // Coming back to a tab that stayed open counts as reading what arrived meanwhile.
    document.addEventListener("visibilitychange", markRead);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", markRead); if (channel) void supabase.removeChannel(channel); };
  }, [bookingId, conversationId, currentUserId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  return <div className="message-thread conversation-thread" aria-live="polite">
    {messages.map((message) => {
      const own = message.senderId === currentUserId;
      return <div key={message.id} className={`message ${message.senderId === consultantId ? "message-consultant" : "message-customer"}`}>
        <small>{own ? "Você" : otherName}</small>
        <span>{message.body}</span>
        <span className="message-meta">
          {messageTime(message.createdAt)}
          {own && (message.readAt
            ? <span className="message-receipt message-receipt-read" title={`Lida às ${messageTime(message.readAt)}`}> · ✓✓ Lida às {messageTime(message.readAt)}</span>
            : <span className="message-receipt"> · ✓ Enviada</span>)}
        </span>
      </div>;
    })}
    {!messages.length && <p className="muted conversation-empty">Nenhuma mensagem ainda. Use este espaço para alinhar os detalhes da conversa.</p>}
    <div ref={end}/>
  </div>;
}
