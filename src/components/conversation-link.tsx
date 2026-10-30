import Link from "next/link";
import { MessageCircle } from "lucide-react";

// Entry point to /conversa/[id] on the booking cards; the badge counts messages from the other side
// since the conversation was last opened.
export function ConversationLink({ bookingId, unread, total }: { bookingId: string; unread: number; total: number }) {
  return <Link className="button button-dark conversation-link" href={`/conversa/${bookingId}`} aria-label={unread ? `Abrir conversa, ${unread} ${unread === 1 ? "mensagem nova" : "mensagens novas"}` : "Abrir conversa"}>
    <MessageCircle size={17}/> {total ? "Abrir conversa" : "Iniciar conversa"}
    {unread > 0 && <span className="unread-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
  </Link>;
}
