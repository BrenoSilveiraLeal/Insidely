"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { markConversationReadAction } from "@/app/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Message = { id: string; body: string; senderId: string; createdAt: string; readAt: string | null; automatic?: boolean };
// A message the moderation refused: shown only to its sender, as a red "bloqueada" bubble without the text.
type BlockedNotice = { id: string; createdAt: string; reason: string };

// Database timestamps come without a time zone and are UTC.
function toDate(value: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
}

function messageTime(value: string) {
  const date = toDate(value);
  const zone = "America/Sao_Paulo";
  const day = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, dateStyle: "short" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(date);
  return day(date) === day(new Date()) ? time : `${day(date).slice(0, 5)} ${time}`;
}

// Instagram-style label under the last own message, refreshed as time passes.
function readLabel(readAt: string, now: number) {
  const minutes = Math.floor((now - toDate(readAt).getTime()) / 60_000);
  if (minutes < 1) return "Lido agora";
  if (minutes < 60) return `Lido há ${minutes} min`;
  const time = messageTime(readAt);
  return time.includes("/") ? `Lido em ${time.replace(" ", " às ")}` : `Lido às ${time}`;
}

// The consultant's messages sit on the right in orange and the customer's on the left, the same way
// for both participants. Under the last own message: "Enviado", then "Lido agora / há X min / às HH:MM",
// updated live: the other
// side's page marks messages read (markConversationReadAction) and realtime delivers the UPDATE.
// systemNotice: a note from Insidely shown first, centred like a chat app's system notice (it is not a
// message: nobody sent it and it is not stored).
export function RealtimeMessageThread({ bookingId, conversationId, currentUserId, consultantId, otherName, initialMessages, blocked = [], systemNotice }: { bookingId: string; conversationId: string; currentUserId: string; consultantId: string; otherName: string; blocked?: BlockedNotice[]; systemNotice?: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const thread = useRef<HTMLDivElement>(null);
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
  // Like a messaging app: the newest message sits at the bottom and older ones move up.
  useEffect(() => { const box = thread.current; if (box) box.scrollTop = box.scrollHeight; }, [messages.length, blocked.length]);
  const lastOwnIndex = messages.findLastIndex((item) => item.senderId === currentUserId);
  const ownSide = currentUserId === consultantId ? "message-consultant" : "message-customer";
  const notices = blocked.map((notice) => ({ ...notice, at: toDate(notice.createdAt).getTime() }));
  const noticesBefore = (createdAt: string | null) => notices.filter((notice) => createdAt === null || notice.at <= toDate(createdAt).getTime());
  const shown = new Set<string>();
  const renderNotices = (createdAt: string | null) => noticesBefore(createdAt).filter((notice) => !shown.has(notice.id) && shown.add(notice.id)).map((notice) =>
    <div className={`message ${ownSide} message-blocked`} key={notice.id} title="Só você vê este aviso">
      <small>Você</small>
      <span>Mensagem bloqueada: {notice.reason === "offensive" ? "ofensa ou palavrão" : "contato ou pagamento por fora"}</span>
      <span className="message-meta">{messageTime(notice.createdAt)} · só você vê</span>
    </div>);
  return <div className="message-thread conversation-thread" aria-live="polite" ref={thread}>
    {systemNotice && <div className="message-system" role="note"><strong>Aviso da Insidely</strong><span>{systemNotice}</span></div>}
    {messages.map((message, index) => {
      const own = message.senderId === currentUserId;
      const side = message.senderId === consultantId ? "message-consultant" : "message-customer";
      const lastOwn = index === lastOwnIndex;
      return <Fragment key={message.id}>
        {renderNotices(message.createdAt)}
        <div className={`message ${side}`}>
          <small>{own ? "Você" : otherName}</small>
          <span>{message.body}</span>
          {message.automatic && <span className="message-automatic">Enviada automaticamente pela Insidely</span>}
          <span className="message-meta">{messageTime(message.createdAt)}</span>
        </div>
        {lastOwn && <span className={`message-seen ${side}-seen`} title={message.readAt ? `Lida às ${messageTime(message.readAt)}` : undefined}>{message.readAt ? readLabel(message.readAt, now) : "Enviado"}</span>}
      </Fragment>;
    })}
    {renderNotices(null)}
    {!messages.length && !blocked.length && <p className="muted conversation-empty">Nenhuma mensagem ainda. Use este espaço para alinhar os detalhes da conversa.</p>}
  </div>;
}
