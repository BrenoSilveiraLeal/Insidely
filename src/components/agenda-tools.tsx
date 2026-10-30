"use client";

import { useActionState, useEffect } from "react";
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

// Pause or vacation: the profile leaves search until the chosen date (or until resumed).
export function PauseProfile({ pausedUntilLabel, paused }: { paused: boolean; pausedUntilLabel: string | null }) {
  const [state, action, pending] = useActionState(pauseProfileAction, undefined);
  const router = useRouter();
  useEffect(() => { if (state?.status === "success") router.refresh(); }, [router, state]);
  if (paused) return <section className="panel form-stack agenda-paused">
    <span className="eyebrow">Perfil pausado</span>
    <h2>{pausedUntilLabel ? `Você volta em ${pausedUntilLabel}.` : "Seu perfil está pausado."}</h2>
    <p className="muted">Enquanto isso, seu perfil não aparece na busca e ninguém consegue agendar. Suas conversas antigas e mensagens continuam disponíveis.</p>
    <form action={resumeProfileAction}><button className="button button-accent">Reativar agora</button></form>
  </section>;
  return <details className="panel agenda-pause">
    <summary><span className="eyebrow">Pausa ou férias</span><strong>Precisa de um tempo? Pause sua agenda.</strong></summary>
    <form action={action} className="form-stack">
      <p className="muted">Seu perfil sai da busca e ninguém consegue agendar até a data de volta. Se houver conversa marcada nesse período, faça a conversa ou cancele antes (no cancelamento, o cliente recebe 100% de volta).</p>
      <label className="field"><span>Volto em (deixe vazio para pausar até reativar)</span><input className="input" type="date" name="until"/></label>
      <Feedback state={state}/>
      <button className="button button-dark" disabled={pending}>{pending ? "Pausando…" : "Pausar perfil"}</button>
    </form>
  </details>;
}
