import { notFound } from "next/navigation";
import { createBookingAction } from "@/app/actions";
import { PublicShell } from "@/components/public-shell";
import { money, publicName, shortDate } from "@/lib/format";
import { getProfessional } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  await requireUser();
  const { id } = await params;
  const { erro } = await searchParams;
  const profile = await getProfessional(id);
  if (!profile) notFound();
  const hasSixtyMinuteSlot = profile.availability.some(slot => slot.endsAt.getTime() - slot.startsAt.getTime() >= 60 * 60 * 1000);
  const errors: Record<string, string> = { preencha: "Escolha um horário e explique o que você precisa decidir (mínimo de 12 caracteres).", indisponivel: "Esse horário acabou de ficar indisponível ou não comporta a duração escolhida. Escolha outro horário.", muito_cedo: "Para proteger o pedido, escolha um horário com pelo menos 15 minutos de antecedência.", sessao: "Sua sessão expirou. Entre novamente para continuar.", temporario: "Não foi possível criar a solicitação agora. Atualize a página e tente novamente." };
  return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Agendamento</span><h1>Prepare uma conversa útil.</h1><p>Com {publicName(profile)} · escolha um horário ainda disponível.</p></div></section><section className="section"><div className="container profile-layout"><form action={createBookingAction.bind(null, profile.id)} className="panel form-stack">{erro && <p className="form-alert" role="alert">{errors[erro] ?? errors.temporario}</p>}<div className="field"><label htmlFor="slot">Horário</label><select className="select" id="slot" name="slot" required><option value="">Selecione</option>{profile.availability.map(slot => <option key={slot.id} value={slot.id}>{shortDate(slot.startsAt)}</option>)}</select></div><div className="field"><label htmlFor="duration">Duração</label><select className="select" id="duration" name="duration"><option value="30">30 minutos · {money(profile.price30Cents)}</option>{hasSixtyMinuteSlot && <option value="60">60 minutos · {money(profile.price60Cents)}</option>}</select>{!hasSixtyMinuteSlot && <small className="muted">Este perfil tem apenas horários de 30 minutos disponíveis.</small>}</div><fieldset className="panel"><legend className="eyebrow">Temas</legend>{["Rotina real", "Cultura da equipe", "Processo seletivo", "Crescimento", "Carga de trabalho"].map(t => <label key={t} style={{ display: "block", margin: 10 }}><input type="checkbox" name="topics" value={t} /> {t}</label>)}</fieldset><div className="field"><label htmlFor="goals">O que você precisa decidir?</label><textarea className="textarea" id="goals" name="goals" required minLength={12} placeholder="Conte o contexto e o que faria esta conversa ser útil." /></div><button className="button button-dark" type="submit" disabled={!profile.availability.length}>Continuar para o checkout</button></form><aside className="booking-box"><span className="eyebrow">Acordo da conversa</span><h2>Experiência, não garantia.</h2><p>O consultor fala da própria vivência. Não representa a empresa, não promete contratação e não compartilha informação confidencial.</p><p className="muted">Se nenhum horário aparecer, este perfil não tem disponibilidade futura no momento.</p></aside></div></section></PublicShell>;
}
