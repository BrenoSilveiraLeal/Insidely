import { notFound } from "next/navigation";
import { BookingSlotFields } from "@/components/booking-slot-fields";
import { BookingRequestForm } from "@/components/booking-request-form";
import { PublicShell } from "@/components/public-shell";
import { money, publicName, shortDate } from "@/lib/format";
import { getProfessional } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Agendar conversa" };
export const dynamic = "force-dynamic";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; slot?: string }> }) {
  const { id } = await params;
  await requireUser(undefined, { nextPath: "/agendar/" + id });
  const { slot: requestedSlot } = await searchParams;
  const profile = await getProfessional(id);
  if (!profile) notFound();
  const slots = profile.availability.map(slot => ({ id: slot.id, label: slot.startsAt <= new Date() ? "Agora (conversa imediata)" : shortDate(slot.startsAt), minutes: Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) }));
  const selectedSlot = slots.some(slot => slot.id === requestedSlot) ? requestedSlot : slots[0]?.id;
  return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Agendamento · horários de Brasília</span><h1>Prepare uma conversa útil.</h1><p>Com {publicName(profile)} · escolha um horário ainda disponível.</p></div></section><section className="section"><div className="container profile-layout">
    <BookingRequestForm profileId={profile.id}>
      <BookingSlotFields slots={slots} defaultSlot={selectedSlot} price30={money(profile.price30Cents)} price60={money(profile.price60Cents)} />
      <fieldset className="topic-select-group"><legend className="eyebrow">Temas</legend>{["Rotina real", "Cultura da equipe", "Processo seletivo", "Crescimento", "Carga de trabalho"].map(t => <label key={t}><input type="checkbox" name="topics" value={t} /> <span>{t}</span></label>)}</fieldset>
      <div className="field"><label htmlFor="goals">O que você precisa decidir?</label><textarea className="textarea" id="goals" name="goals" required minLength={12} maxLength={2000} placeholder="Conte o contexto e o que faria esta conversa ser útil." /></div>
    </BookingRequestForm>
    <aside className="booking-box"><span className="eyebrow">Acordo da conversa</span><h2>Experiência, não garantia.</h2><p>O consultor fala da própria vivência. Não representa a empresa, não promete contratação e não compartilha informação confidencial.</p><p className="muted">Se nenhum horário aparecer, este perfil não tem disponibilidade futura no momento.</p></aside>
  </div></section></PublicShell>;
}
