import { notFound } from "next/navigation";
import { createBookingAction } from "@/app/actions";
import { BookingSlotFields } from "@/components/booking-slot-fields";
import { PublicShell } from "@/components/public-shell";
import { money, publicName, shortDate } from "@/lib/format";
import { getProfessional } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Agendar conversa" };
export const dynamic = "force-dynamic";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; slot?: string }> }) {
  const { id } = await params;
  await requireUser(undefined, { nextPath: "/agendar/" + id });
  const { erro, slot: selectedSlot } = await searchParams;
  const profile = await getProfessional(id);
  if (!profile) notFound();
  const errors: Record<string, string> = { preencha: "Escolha um horário e explique o que você precisa decidir (mínimo de 12 caracteres).", indisponivel: "Esse horário acabou de ficar indisponível ou não comporta a duração escolhida. Escolha outro horário.", muito_cedo: "Esse horário já não está disponível. Atualize a lista ou peça ao consultor para abrir outro horário imediato.", sessao: "Sua sessão expirou. Entre novamente para continuar.", temporario: "Não foi possível criar a solicitação agora. Atualize a página e tente novamente." };
  return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Agendamento · horários de Brasília</span><h1>Prepare uma conversa útil.</h1><p>Com {publicName(profile)} · escolha um horário ainda disponível.</p></div></section><section className="section"><div className="container profile-layout"><form action={createBookingAction.bind(null, profile.id)} className="panel form-stack">{erro && <p className="form-alert" role="alert">{errors[erro] ?? errors.temporario}</p>}<BookingSlotFields slots={profile.availability.map(slot => ({ id: slot.id, label: slot.startsAt <= new Date() ? "Agora (conversa imediata)" : shortDate(slot.startsAt), minutes: Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) }))} defaultSlot={selectedSlot} price30={money(profile.price30Cents)} price60={money(profile.price60Cents)} /><fieldset className="panel"><legend className="eyebrow">Temas</legend>{["Rotina real", "Cultura da equipe", "Processo seletivo", "Crescimento", "Carga de trabalho"].map(t => <label key={t} style={{ display: "block", margin: 10 }}><input type="checkbox" name="topics" value={t} /> {t}</label>)}</fieldset><div className="field"><label htmlFor="goals">O que você precisa decidir?</label><textarea className="textarea" id="goals" name="goals" required minLength={12} placeholder="Conte o contexto e o que faria esta conversa ser útil." /></div><button className="button button-dark" type="submit" disabled={!profile.availability.length}>Continuar para o checkout</button></form><aside className="booking-box"><span className="eyebrow">Acordo da conversa</span><h2>Experiência, não garantia.</h2><p>O consultor fala da própria vivência. Não representa a empresa, não promete contratação e não compartilha informação confidencial.</p><p className="muted">Se nenhum horário aparecer, este perfil não tem disponibilidade futura no momento.</p></aside></div></section></PublicShell>;
}
