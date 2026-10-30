"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRecurringAvailabilityAction, duplicateWeekAction, pauseProfileAction, resumeProfileAction } from "@/app/actions";

const WEEKDAYS = [["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["0", "Dom"]] as const;

function Feedback({ state }: { state: { status: "success" | "error"; message: string } | undefined }) {
  return state ? <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null;
}

// Weekly slots and copying the current week, both in Brasília time.
export function RecurringAvailability() {
  const [state, action, pending] = useActionState(createRecurringAvailabilityAction, undefined);
  const [copyState, copyAction, copyPending] = useActionState(duplicateWeekAction, undefined);
  const router = useRouter();
  useEffect(() => { if (state?.status === "success" || copyState?.status === "success") router.refresh(); }, [router, state, copyState]);
  return <section className="panel form-stack">
    <span className="eyebrow">Horários que se repetem</span>
    <h2>Monte sua semana de uma vez.</h2>
    <form action={action} className="form-stack">
      <fieldset className="weekday-picker"><legend>Dias da semana</legend>{WEEKDAYS.map(([value, label]) => <label key={value}><input type="checkbox" name="weekday" value={value}/><span>{label}</span></label>)}</fieldset>
      <div className="profile-form-grid">
        <label className="field"><span>Horário (Brasília)</span><input className="input" type="time" name="time" required step={900}/></label>
        <label className="field"><span>Duração</span><select className="select" name="duration" defaultValue="30"><option value="30">30 minutos</option><option value="60">1 hora</option></select></label>
        <label className="field"><span>Por quantas semanas</span><select className="select" name="weeks" defaultValue="4">{[1, 2, 3, 4, 6, 8].map((weeks) => <option key={weeks} value={weeks}>{weeks} {weeks === 1 ? "semana" : "semanas"}</option>)}</select></label>
      </div>
      <Feedback state={state}/>
      <button className="button button-accent" disabled={pending}>{pending ? "Criando…" : "Criar horários"}</button>
    </form>
    <form action={copyAction} className="agenda-copy">
      <span>Copiar os horários dos próximos 7 dias para</span>
      <select className="select" name="weeks" defaultValue="1" aria-label="Quantas semanas copiar">{[1, 2, 3, 4].map((weeks) => <option key={weeks} value={weeks}>{weeks === 1 ? "a semana seguinte" : `as próximas ${weeks} semanas`}</option>)}</select>
      <button className="button button-ghost button-sm" disabled={copyPending}>{copyPending ? "Copiando…" : "Copiar semana"}</button>
    </form>
    <Feedback state={copyState}/>
  </section>;
}

// Pause or vacation: a button, then the return date. Conversations booked inside the pause are
// checked as the date changes, so the consultant sees why it can't be paused before submitting.
type Upcoming = { id: string; label: string; startsAt: string; customer: string };

export function PauseProfile({ pausedUntilLabel, paused, upcoming }: { paused: boolean; pausedUntilLabel: string | null; upcoming: Upcoming[] }) {
  const [state, action, pending] = useActionState(pauseProfileAction, undefined);
  const [confirming, setConfirming] = useState(false);
  const [until, setUntil] = useState("");
  const [today] = useState(() => Date.now());
  const router = useRouter();
  useEffect(() => { if (state?.status === "success") router.refresh(); }, [router, state]);
  if (paused) return <section className="panel form-stack agenda-paused">
    <span className="eyebrow">Perfil pausado</span>
    <h2>{pausedUntilLabel ? `Você volta em ${pausedUntilLabel}.` : "Seu perfil está pausado."}</h2>
    <p className="muted">Enquanto isso, seu perfil não aparece na busca e ninguém consegue agendar. Suas conversas antigas e mensagens continuam disponíveis.</p>
    <form action={resumeProfileAction}><button className="button button-accent">Reativar agora</button></form>
  </section>;
  // Return day ends at 23:59 in Brasília; with no date the pause covers every booked conversation.
  const untilTime = until ? new Date(`${until}T23:59:59-03:00`).getTime() : Infinity;
  const blocking = upcoming.filter((item) => new Date(item.startsAt).getTime() <= untilTime);
  const after = upcoming.filter((item) => new Date(item.startsAt).getTime() > untilTime);
  const returnLabel = until ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${until}T12:00:00Z`)) : null;
  const latestReturn = blocking.length ? new Date(new Date(blocking[0].startsAt).getTime() - 86_400_000) : null;
  return <section className="panel agenda-pause">
    <div className="agenda-pause-head">
      <div><span className="eyebrow">Pausa ou férias</span><strong>Precisa de um tempo? Pause sua agenda.</strong><p className="muted">Seu perfil sai da busca e ninguém consegue agendar até a data de volta.</p></div>
      {!confirming && <button className="button button-dark" type="button" onClick={() => setConfirming(true)}>Ativar pausa ou férias</button>}
    </div>
    {confirming && <form action={action} className="agenda-pause-confirm">
      <label className="field agenda-pause-date"><span>Quando você volta?</span><input className="input" type="date" name="until" value={until} min={new Date(today).toISOString().slice(0, 10)} onChange={(event) => setUntil(event.target.value)}/><small className="muted">{returnLabel ? `O perfil volta sozinho no dia ${returnLabel}.` : "Sem data, o perfil fica pausado até você reativar."}</small></label>
      {blocking.length > 0 ? <div className="agenda-pause-note is-blocked" role="alert">
        <strong>{returnLabel ? `Não dá para pausar até ${returnLabel}` : "Não dá para pausar sem data de volta"}</strong>
        <p>{blocking.length === 1 ? "Você tem uma conversa marcada" : `Você tem ${blocking.length} conversas marcadas`} nesse período. Escolha {latestReturn && latestReturn.getTime() > today ? `uma volta até ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(latestReturn)}` : "outra data"} ou faça ou cancele {blocking.length === 1 ? "a conversa" : "as conversas"} antes. No cancelamento, o cliente recebe 100% de volta.</p>
        <ul className="agenda-pause-list">{blocking.map((item) => <li key={item.id}><span>{item.label}</span><span className="muted">{item.customer}</span></li>)}</ul>
        <a className="text-link" href="/consultor/consultas">Abrir Consultas</a>
      </div> : after.length > 0 ? <div className="agenda-pause-note">
        <strong>{after.length === 1 ? "Sua conversa depois da volta continua valendo." : `Suas ${after.length} conversas depois da volta continuam valendo.`}</strong>
        <p className="muted">Se você faltar a uma conversa marcada, o cliente é avisado e pode contestar: o valor não é repassado a você e volta para ele.</p>
      </div> : null}
      <Feedback state={state}/>
      <div className="agenda-pause-actions"><button className="button button-ghost" type="button" onClick={() => { setConfirming(false); setUntil(""); }}>Cancelar</button><button className="button button-accent" disabled={pending || blocking.length > 0}>{pending ? "Pausando…" : "Pausar meu perfil"}</button></div>
    </form>}
  </section>;
}
