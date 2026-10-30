import { parseDbDate, shortDate } from "@/lib/format";
import type { ThreadMessage } from "@/lib/support-threads";

// A support case as a conversation: the opening message, then replies from both sides.
// "viewer" decides which side reads as "you".
export function SupportThread({ opening, messages, viewer, personName, closedLabel }: { opening: { body: string; createdAt: string }; messages: ThreadMessage[]; viewer: "staff" | "person"; personName: string; closedLabel?: string | null }) {
  const bubble = (key: string, fromStaff: boolean, author: string, body: string, createdAt: string) => {
    const own = (viewer === "staff") === fromStaff;
    return <div className={`support-msg${own ? " is-own" : ""}${fromStaff ? " is-staff" : ""}`} key={key}>
      <div className="support-msg-meta"><strong>{author}</strong><span>{shortDate(parseDbDate(createdAt))}</span></div>
      <p>{body}</p>
    </div>;
  };
  const staffName = (message: ThreadMessage) => viewer === "staff" ? (message.authorName ?? "Equipe") : "Suporte Insidely";
  return <div className="support-thread">
    {bubble("opening", false, viewer === "person" ? "Você" : personName, opening.body, opening.createdAt)}
    {messages.map((message) => bubble(message.id, message.fromStaff, message.fromStaff ? staffName(message) : viewer === "person" ? "Você" : personName, message.body, message.createdAt))}
    {closedLabel && <div className="chat-closed"><span>{closedLabel}</span></div>}
  </div>;
}
