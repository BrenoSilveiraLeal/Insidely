"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Message = { id: string; body: string; senderId: string };

export function RealtimeMessageThread({ conversationId, currentUserId, initialMessages }: { conversationId: string; currentUserId: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`conversation:${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "Message", filter: `conversationId=eq.${conversationId}` }, (payload) => {
      const row = payload.new as Message;
      setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, row]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);
  return <div className="message-thread" aria-live="polite">{messages.map((message) => <div key={message.id} className={`message ${message.senderId === currentUserId ? "message-own" : ""}`}>{message.body}</div>)}</div>;
}
