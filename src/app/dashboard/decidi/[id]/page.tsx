import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DecisionStoryForm } from "@/components/decision-story-form";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "O que você decidiu?" };
export const dynamic = "force-dynamic";

// "Decidi!": a few weeks after a conversation the customer is invited to tell what they decided.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: booking } = await supabase.from("Booking").select("id, customerId, startsAt, professionalProfileId").eq("id", id).maybeSingle();
  if (!booking || booking.customerId !== user.id) notFound();
  const [{ data: card }, { data: story }] = await Promise.all([
    supabase.from("public_profile_cards").select("user").eq("id", booking.professionalProfileId).maybeSingle(),
    supabase.from("DecisionStory").select("story, allowPublish").eq("bookingId", id).maybeSingle(),
  ]);
  const consultant = (Array.isArray(card?.user) ? card.user[0]?.name : card?.user?.name) || "o consultor";
  return <DashboardShell mode="user" title="Decidi!" canConsultant={user.role === Role.CONSULTANT}>
    <section className="panel form-stack decision-story">
      <span className="eyebrow">Conversa com {consultant} · {shortDate(parseDbDate(booking.startsAt))}</span>
      <h2>Conta pra gente: o que você decidiu?</h2>
      <p className="muted">Aceitou a vaga, mudou de área, desistiu, ainda está pensando? Sua resposta ajuda a Insidely a melhorar e, se você autorizar, pode inspirar quem está passando pela mesma dúvida.</p>
      <DecisionStoryForm bookingId={id} defaultStory={story?.story ?? ""} defaultAllow={story?.allowPublish ?? false}/>
    </section>
  </DashboardShell>;
}
