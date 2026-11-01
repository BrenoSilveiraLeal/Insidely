import { CalendarSync, Check, RefreshCw } from "lucide-react";
import { disconnectCalendarAction, syncCalendarNowAction } from "@/app/actions";
import { calendarErrorText, type CalendarLink } from "@/lib/google-calendar-link";
import { parseDbDate, shortDate } from "@/lib/format";

// "Google Agenda": connect once, then the app keeps it in step every few minutes (both directions
// for consultants, conversations into the calendar for customers). Agenda (consultant) and
// Configurações (customer).
export function GoogleCalendarPanel({ link, returnTo, consultant }: { link: CalendarLink | null; returnTo: "/consultor/agenda" | "/dashboard/configuracoes"; consultant: boolean }) {
  const features = [
    "Conversas confirmadas entram na sua agenda, com o link da sala, e saem se forem canceladas.",
    ...(consultant ? ["Horários livres que batem com compromissos do Google são removidos. Conversas já reservadas não mudam."] : []),
  ];
  const problem = calendarErrorText(link?.lastError ?? null);
  return <section className="panel calendar-link">
    <header className="calendar-link-head">
      <span className="calendar-link-icon" aria-hidden="true"><CalendarSync size={20}/></span>
      <div className="calendar-link-title"><span className="eyebrow">Google Agenda</span><strong>{link ? link.googleEmail ?? "Conta Google conectada" : "Conecte sua agenda do Google"}</strong></div>
      {link ? <span className={`calendar-link-status${problem ? " is-warning" : ""}`}>{problem ? "Com problema" : "Conectado"}</span> : <a className="button button-dark button-sm" href={`/auth/google-agenda?returnTo=${encodeURIComponent(returnTo)}`}>Conectar</a>}
    </header>
    <ul className="calendar-link-features">{features.map((feature) => <li key={feature}><Check size={15} aria-hidden="true"/><span>{feature}</span></li>)}</ul>
    {problem && <p className="form-error">{problem}</p>}
    <footer className="calendar-link-foot">
      <small className="muted">{link ? (link.lastSyncAt ? `Atualiza sozinho a cada poucos minutos · última vez em ${shortDate(parseDbDate(link.lastSyncAt))}` : "Atualiza sozinho a cada poucos minutos") : "Você conecta uma vez e pode desconectar quando quiser."}</small>
      {link && <div className="calendar-link-actions"><form action={syncCalendarNowAction.bind(null, returnTo)}><button className="button button-ghost button-sm"><RefreshCw size={14} aria-hidden="true"/>Sincronizar agora</button></form><form action={disconnectCalendarAction.bind(null, returnTo)}><button className="calendar-link-disconnect">Desconectar</button></form></div>}
    </footer>
  </section>;
}

// The message after connecting, syncing or disconnecting (?sync=…).
export function calendarSyncText(sync: string, added?: string, removed?: string) {
  const parts = [Number(added) > 0 ? `${added} conversa(s) adicionada(s) ao Google Agenda` : "", Number(removed) > 0 ? `${removed} horário(s) livre(s) que batiam com compromissos do Google removido(s)` : ""].filter(Boolean);
  if (sync === "ok") return { ok: true, text: `Google Agenda conectado e sincronizado${parts.length ? `: ${parts.join("; ")}.` : "."}` };
  if (sync === "agora") return { ok: true, text: `Sincronizado${parts.length ? `: ${parts.join("; ")}.` : ". Nada mudou."}` };
  if (sync === "desconectado") return { ok: true, text: "Google Agenda desconectado. Os eventos já criados continuam na sua agenda." };
  if (sync === "linked-later") return { ok: true, text: "Google Agenda conectado. A primeira sincronização não terminou; tentamos de novo em alguns minutos." };
  if (sync === "permission-error") return { ok: false, text: "O Google não liberou o acesso à agenda. Tente de novo e, na tela do Google, marque todas as caixas de permissão." };
  if (sync === "api-disabled") return { ok: false, text: "Sua agenda foi conectada, mas o Google Agenda está temporariamente indisponível para a Insidely. A equipe já foi avisada e a sincronização volta sozinha." };
  if (sync === "account-mismatch") return { ok: false, text: "A conta Google escolhida pertence a outro usuário da Insidely." };
  return { ok: false, text: "Não foi possível conectar o Google Agenda agora. Tente de novo." };
}
