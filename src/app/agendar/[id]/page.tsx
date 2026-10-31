import { TopicIdeas } from "@/components/topic-ideas";
import { MessageRequestForm } from "@/components/message-request-form";
import { isSlotStillBookable } from "@/lib/booking-policy";
import { notFound } from "next/navigation";
import { BookingSlotFields } from "@/components/booking-slot-fields";
import { BookingRequestForm } from "@/components/booking-request-form";
import { PublicShell } from "@/components/public-shell";
import { money, publicName, shortDate } from "@/lib/format";
import { getProfessional } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { getCustomerIdentity } from "@/lib/customer-identity";
import { CustomerIdentityForm } from "@/components/customer-identity-form";

export const metadata = { title: "Agendar conversa" };
export const dynamic = "force-dynamic";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; slot?: string; formato?: string }> }) {
  const { id } = await params;
  const user = await requireUser(undefined, { nextPath: "/agendar/" + id });
  const { slot: requestedSlot, formato } = await searchParams;
  const [profile, identity] = await Promise.all([getProfessional(id), getCustomerIdentity(user.id)]);
  if (!profile) notFound();
  if (!identity) return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Antes do primeiro agendamento</span><h1>Identifique-se para agendar.</h1><p>Com {publicName(profile)} · leva menos de um minuto e só é pedido uma vez.</p></div></section><section className="section"><div className="container profile-layout">
    <section className="panel"><CustomerIdentityForm next={`/agendar/${profile.id}${requestedSlot ? `?slot=${encodeURIComponent(requestedSlot)}` : ""}`}/></section>
    <aside className="booking-box"><span className="eyebrow">Por que pedimos o CPF</span><h2>Segurança para os dois lados.</h2><p>As conversas acontecem por vídeo entre pessoas que não se conhecem. Com a identificação, a Insidely consegue responder a denúncias e a autoridades se algo grave acontecer.</p><p className="muted">O consultor vê apenas o CPF parcialmente mascarado e a sua idade. O CPF não pode ser usado em outra conta.</p></aside>
  </div></section></PublicShell>;
  const topicIdeas = profile.topics.length ? profile.topics : ["Rotina real", "Cultura da equipe", "Processo seletivo", "Crescimento", "Carga de trabalho"];
  // "Perguntas por mensagem" (only when this consultant offers it).
  if (formato === "mensagem" && profile.messagePriceCents) return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Perguntas por mensagem</span><h1>Tire suas dúvidas por escrito.</h1><p>Com {publicName(profile)} · sem horário marcado.</p></div></section><section className="section"><div className="container profile-layout">
    <MessageRequestForm profileId={profile.id} price={money(profile.messagePriceCents + 500)} topics={topicIdeas}/>
    <aside className="booking-box"><span className="eyebrow">Acordo da conversa</span><h2>Experiência, não garantia.</h2><p>O consultor fala da própria vivência. Não representa a empresa, não promete contratação e não compartilha informação confidencial.</p><p className="muted">Prefere conversar ao vivo? <a className="inline-link" href={`/agendar/${profile.id}`}>Agende uma conversa por vídeo</a>.</p></aside>
  </div></section></PublicShell>;
  const slots = profile.availability.filter((slot) => isSlotStillBookable(slot)).map(slot => ({ id: slot.id, label: slot.startsAt <= new Date() ? "Agora (conversa imediata)" : shortDate(slot.startsAt), minutes: Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) }));
  const selectedSlot = slots.some(slot => slot.id === requestedSlot) ? requestedSlot : slots[0]?.id;
  return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Agendamento · horários de Brasília</span><h1>Prepare uma conversa útil.</h1><p>Com {publicName(profile)} · escolha um horário ainda disponível.</p></div></section><section className="section"><div className="container profile-layout">
    <BookingRequestForm profileId={profile.id}>
      <BookingSlotFields slots={slots} defaultSlot={selectedSlot} price30={money(profile.price30Cents)} price60={money(profile.price60Cents)} />
      <div className="field"><label htmlFor="goals">O que você precisa decidir?</label><textarea className="textarea" id="goals" name="goals" required minLength={12} maxLength={2000} rows={5} placeholder="Conte o contexto e o que faria esta conversa ser útil." /><TopicIdeas targetId="goals" topics={topicIdeas}/></div>
    </BookingRequestForm>
    <aside className="booking-box"><span className="eyebrow">Acordo da conversa</span><h2>Experiência, não garantia.</h2><p>O consultor fala da própria vivência. Não representa a empresa, não promete contratação e não compartilha informação confidencial.</p><p className="muted">Se nenhum horário aparecer, este perfil não tem disponibilidade futura no momento.</p></aside>
  </div></section></PublicShell>;
}
