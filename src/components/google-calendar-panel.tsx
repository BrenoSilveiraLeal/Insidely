import { disconnectCalendarAction, syncCalendarNowAction } from "@/app/actions";
import { calendarErrorText, type CalendarLink } from "@/lib/google-calendar-link";
import { parseDbDate, shortDate } from "@/lib/format";

// "Google Agenda": connect once, then the app keeps it in step every few minutes (both directions
// for consultants, conversations into the calendar for customers). Agenda (consultant) and
// Configurações (customer).
export function GoogleCalendarPanel({ link, returnTo, consultant }: { link: CalendarLink | null; returnTo: "/consultor/agenda" | "/dashboard/configuracoes"; consultant: boolean }) {
  const what = consultant
    ? "Suas conversas confirmadas entram sozinhas no seu Google Agenda (e saem se forem canceladas), e os horários livres da Insidely que batem com compromissos do Google são removidos. Conversas já reservadas não mudam."
    : "Suas conversas confirmadas entram sozinhas no seu Google Agenda, com o link da sala, e saem se forem canceladas.";
  const problem = calendarErrorText(link?.lastError ?? null);
  return <section className="panel agenda-sync"><div><span className="eyebrow">Google Agenda</span>
    {link
      ? <><strong>Conectado{link.googleEmail ? ` a ${link.googleEmail}` : ""}</strong><p className="muted">{what} Atualiza a cada poucos minutos{link.lastSyncAt ? `; última vez em ${shortDate(parseDbDate(link.lastSyncAt))}` : ""}.</p>{problem && <p className="form-error">{problem}</p>}</>
      : <><strong>Conecte sua agenda do Google</strong><p className="muted">{what} Você conecta uma vez e pode desconectar quando quiser.</p></>}
  </div>
    {link
      ? <div className="agenda-sync-actions"><form action={syncCalendarNowAction.bind(null, returnTo)}><button className="button button-ghost button-sm">Sincronizar agora</button></form><form action={disconnectCalendarAction.bind(null, returnTo)}><button className="button button-ghost button-sm">Desconectar</button></form></div>
      : <a className="button button-dark" href={`/auth/google-agenda?returnTo=${encodeURIComponent(returnTo)}`}>Conectar Google Agenda</a>}
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
