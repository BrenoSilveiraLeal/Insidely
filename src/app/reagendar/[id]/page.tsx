import Link from "next/link";
import { notFound } from "next/navigation";
import { payRescheduleAction } from "@/app/actions";
import { PublicShell } from "@/components/public-shell";
import { RescheduleForm } from "@/components/reschedule-form";
import { SimulatedCheckoutForm } from "@/components/simulated-checkout-form";
import { canRescheduleBooking, isRescheduleSlot, RESCHEDULE_FEE_CENTS, RESCHEDULE_HOLD_MINUTES, RESCHEDULE_MIN_HOURS } from "@/lib/booking-policy";
import { money, parseDbDate, publicName, shortDate } from "@/lib/format";
import { getProfessional } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Reagendar conversa" };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  metodo: "Selecione uma forma de pagamento.",
  expirado: "A reserva do novo horário expirou ou o horário não está mais livre. Escolha de novo.",
};

// Customer reschedule of a video conversation: pick a free slot of the same consultant, then pay the
// fee plus any price difference. Rules in booking-policy.ts and migration 20261101104000.
export default async function ReschedulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  const user = await requireUser(undefined, { nextPath: `/reagendar/${id}` });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  await supabase.rpc("expire_stale_reschedules");
  const { data: row } = await supabase.from("Booking").select("id, customerId, professionalProfileId, status, format, startsAt, durationMinutes, subtotalCents").eq("id", id).maybeSingle();
  if (!row || row.customerId !== user.id) notFound();
  const booking = { ...row, startsAt: parseDbDate(row.startsAt) };
  const [{ data: history }, profile] = await Promise.all([
    supabase.from("BookingReschedule").select("id, status, newStartsAt, newDurationMinutes, differenceCents, feeCents, totalCents, createdAt").eq("bookingId", id).in("status", ["PENDING_PAYMENT", "PAID"]),
    getProfessional(booking.professionalProfileId),
  ]);
  if (!profile) notFound();
  type Request = { id: string; status: string; newStartsAt: string; newDurationMinutes: number; differenceCents: number; feeCents: number; totalCents: number; createdAt: string };
  const requests = (history ?? []) as Request[];
  const pending = requests.find((item) => item.status === "PENDING_PAYMENT");
  const allowed = canRescheduleBooking(booking, requests.some((item) => item.status === "PAID"));
  const hero = <section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Reagendamento · horários de Brasília</span><h1>Mudar o horário da conversa.</h1><p>Com {publicName(profile)} · hoje marcada para {shortDate(booking.startsAt)} ({booking.durationMinutes} min).</p></div></section>;
  const rules = <aside className="booking-box"><span className="eyebrow">Como funciona</span><h2>Um reagendamento por conversa.</h2><ul className="reschedule-rules">
    <li>Até {RESCHEDULE_MIN_HOURS} horas antes do início, para outro horário livre do mesmo consultor.</li>
    <li>Taxa de reagendamento de {money(RESCHEDULE_FEE_CENTS)}.</li>
    <li>Se a nova opção custar mais (por exemplo, de 30 para 60 minutos), você paga só a diferença. Não dá para reduzir a duração.</li>
    <li>O novo horário fica reservado por {RESCHEDULE_HOLD_MINUTES} minutos até o pagamento; depois disso, o horário antigo é liberado e o consultor é avisado.</li>
  </ul><p className="muted">Veja os <Link className="text-link" href="/termos" target="_blank">Termos de Uso</Link>.</p></aside>;

  if (!allowed && !pending) return <PublicShell>{hero}<section className="section"><div className="container profile-layout"><section className="panel"><h2>Esta conversa não pode ser reagendada.</h2><p className="muted">O reagendamento vale para conversas por vídeo confirmadas, uma vez por conversa e até {RESCHEDULE_MIN_HOURS} horas antes do início. Se precisar, você ainda pode cancelar em Agendamentos, seguindo a regra de reembolso.</p><Link className="button button-dark" href="/dashboard/agendamentos">Voltar para Agendamentos</Link></section>{rules}</div></section></PublicShell>;

  if (pending) {
    const holdUntil = new Date(parseDbDate(pending.createdAt).getTime() + RESCHEDULE_HOLD_MINUTES * 60_000);
    return <PublicShell>{hero}<section className="section"><div className="container profile-layout"><section className="panel form-stack">
      <h2>Confirme o novo horário</h2>
      <ul className="detail-list">
        <li><span>Novo horário</span><strong>{shortDate(parseDbDate(pending.newStartsAt))} · {pending.newDurationMinutes} min</strong></li>
        <li><span>Taxa de reagendamento</span><strong>{money(pending.feeCents)}</strong></li>
        <li><span>Diferença de valor</span><strong>{pending.differenceCents ? money(pending.differenceCents) : "Sem diferença"}</strong></li>
        <li className="reschedule-summary-total"><span>Total a pagar</span><strong>{money(pending.totalCents)}</strong></li>
      </ul>
      <p className="muted">O horário fica reservado até {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(holdUntil)}. Até o pagamento, sua conversa continua no horário atual.</p>
      {erro && errors[erro] && <p className="form-alert" role="alert">{errors[erro]}</p>}
      <SimulatedCheckoutForm bookingId={`reagendamento-${pending.id}`} action={payRescheduleAction.bind(null, id, pending.id)}/>
      {allowed && <details className="profile-edit-more"><summary>Escolher outro horário</summary><RescheduleFormFor booking={booking} profile={profile}/></details>}
    </section>{rules}</div></section></PublicShell>;
  }

  return <PublicShell>{hero}<section className="section"><div className="container profile-layout"><div className="form-stack">
    {erro && errors[erro] && <p className="form-alert" role="alert">{errors[erro]}</p>}
    <RescheduleFormFor booking={booking} profile={profile}/>
  </div>{rules}</div></section></PublicShell>;
}

function RescheduleFormFor({ booking, profile }: { booking: { id: string; startsAt: Date; durationMinutes: number; subtotalCents: number }; profile: NonNullable<Awaited<ReturnType<typeof getProfessional>>> }) {
  const slots = profile.availability
    .filter((slot) => isRescheduleSlot(slot, booking.startsAt))
    .map((slot) => ({ id: slot.id, label: shortDate(slot.startsAt), minutes: Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) }))
    .filter((slot) => slot.minutes >= booking.durationMinutes);
  if (!slots.length) return <section className="panel"><h2>Nenhum horário livre agora.</h2><p className="muted">O consultor não tem outro horário disponível que comporte a sua conversa. Sua conversa continua no horário atual; volte mais tarde para ver se abriram novos horários.</p><Link className="button button-ghost" href="/dashboard/agendamentos">Voltar para Agendamentos</Link></section>;
  return <RescheduleForm bookingId={booking.id} slots={slots} currentMinutes={booking.durationMinutes} price30Cents={profile.price30Cents} price60Cents={profile.price60Cents} paidSubtotalCents={booking.subtotalCents} feeCents={RESCHEDULE_FEE_CENTS}/>;
}
