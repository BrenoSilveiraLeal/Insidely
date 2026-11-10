"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTextInput } from "@/components/masked-inputs";
import { pauseProfileAction, resumeProfileAction, saveChatHoursAction } from "@/app/actions";
import { WEEKDAY_LABELS, type ChatWindow } from "@/lib/chat-hours";

type State = { status: "success" | "error"; message: string } | undefined;
function Feedback({ state }: { state: State }) {
  return state ? <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null;
}

const ORDER = [1, 2, 3, 4, 5, 6, 0];

// The hours the consultant usually answers, one row per weekday (Brasília time).
export function ChatHoursForm({ windows }: { windows: ChatWindow[] }) {
  const [state, action, pending] = useActionState(saveChatHoursAction, undefined);
  const [enabled, setEnabled] = useState<Record<number, boolean>>(() => Object.fromEntries(ORDER.map((day) => [day, windows.some((window) => window.day === day)])));
  const router = useRouter();
  useEffect(() => { if (state?.status === "success") router.refresh(); }, [router, state]);
  return <section className="panel form-stack">
    <span className="eyebrow">Horários de atendimento</span>
    <h2>Quando você costuma responder?</h2>
    <p className="muted">Aparece no seu perfil como “Costuma responder” e, dentro desses horários, com o selo “Disponível agora”. O cliente pode abrir um chat a qualquer hora; você tem 24 horas para responder depois da primeira mensagem dele.</p>
    <form action={action} className="form-stack">
      <div className="chat-hours">{ORDER.map((day) => {
        const current = windows.find((window) => window.day === day);
        return <div className={`chat-hours-row${enabled[day] ? "" : " is-off"}`} key={day}>
          <label className="check-row"><input type="checkbox" name={`on${day}`} checked={enabled[day]} onChange={(event) => setEnabled((value) => ({ ...value, [day]: event.target.checked }))}/><span>{WEEKDAY_LABELS[day]}</span></label>
          <input className="input" type="time" name={`start${day}`} aria-label={`${WEEKDAY_LABELS[day]}: início`} defaultValue={current?.start ?? "19:00"} disabled={!enabled[day]}/>
          <span className="muted" aria-hidden="true">até</span>
          <input className="input" type="time" name={`end${day}`} aria-label={`${WEEKDAY_LABELS[day]}: fim`} defaultValue={current?.end ?? "22:00"} disabled={!enabled[day]}/>
        </div>;
      })}</div>
      <Feedback state={state}/>
      <button className="button button-accent" disabled={pending}>{pending ? "Salvando…" : "Salvar horários"}</button>
    </form>
  </section>;
}

// Pause or vacation: the profile leaves the search and nobody can open a new chat until the return date.
// Chats already open continue.
export function PauseProfile({ pausedUntilLabel, paused }: { paused: boolean; pausedUntilLabel: string | null }) {
  const [state, action, pending] = useActionState(pauseProfileAction, undefined);
  const [confirming, setConfirming] = useState(false);
  const [until, setUntil] = useState("");
  const [today] = useState(() => Date.now());
  const router = useRouter();
  useEffect(() => { if (state?.status === "success") router.refresh(); }, [router, state]);
  if (paused) return <section className="panel form-stack agenda-paused">
    <span className="eyebrow">Perfil pausado</span>
    <h2>{pausedUntilLabel ? `Você volta em ${pausedUntilLabel}.` : "Seu perfil está pausado."}</h2>
    <p className="muted">Enquanto isso, seu perfil não aparece na busca e ninguém consegue abrir um chat novo. Suas conversas e mensagens continuam disponíveis.</p>
    <form action={resumeProfileAction}><button className="button button-accent">Reativar agora</button></form>
  </section>;
  const returnLabel = until ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${until}T12:00:00Z`)) : null;
  return <section className="panel agenda-pause">
    <div className="agenda-pause-head">
      <div><span className="eyebrow">Pausa ou férias</span><strong>Precisa de um tempo? Pause seu perfil.</strong><p className="muted">Seu perfil sai da busca e ninguém consegue abrir um chat novo até a data de volta.</p></div>
      {!confirming && <button className="button button-dark" type="button" onClick={() => setConfirming(true)}>Ativar pausa ou férias</button>}
    </div>
    {confirming && <form action={action} className="agenda-pause-confirm">
      <label className="field agenda-pause-date"><span>Quando você volta?</span><DateTextInput id="pause-until" name="until" min={new Date(today).toISOString().slice(0, 10)} onValue={setUntil}/><small className="muted">{returnLabel ? `O perfil volta sozinho no dia ${returnLabel}.` : "Sem data, o perfil fica pausado até você reativar."}</small></label>
      <Feedback state={state}/>
      <div className="agenda-pause-actions"><button className="button button-dark" disabled={pending}>{pending ? "Pausando…" : "Pausar perfil"}</button><button className="button button-ghost" type="button" onClick={() => setConfirming(false)}>Cancelar</button></div>
    </form>}
  </section>;
}
