import { Role } from "@/lib/domain";
import { ChatHoursForm, PauseProfile } from "@/components/chat-hours-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/session";
import { parseDbDate } from "@/lib/format";
import { describeChatHours, parseChatHours } from "@/lib/chat-hours";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Horários" };
export const dynamic = "force-dynamic";

// Conversations are chats bought at any time: the consultant only says when they usually answer,
// and can pause the profile.
export default async function Page({ searchParams }: { searchParams: Promise<{ pausa?: string }> }) {
  const user = await requireUser([Role.CONSULTANT]);
  const query = await searchParams;
  // Pause and chat-hours columns are added by migrations beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (createSupabaseServiceClient() as any).from("ProfessionalProfile").select("pausedAt, pausedUntil, chatHours").eq("userId", user.id).maybeSingle();
  const paused = Boolean(profile?.pausedAt) && (!profile?.pausedUntil || parseDbDate(profile.pausedUntil) > new Date());
  const windows = parseChatHours(profile?.chatHours);
  return <DashboardShell mode="consultant" title="Horários">
    {query.pausa === "retomada" && <p className="form-feedback" role="status">Perfil reativado. Ele voltou para a busca.</p>}
    <div className="agenda-page">
      <PauseProfile paused={paused} pausedUntilLabel={paused && profile?.pausedUntil ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long" }).format(parseDbDate(profile.pausedUntil)) : null}/>
      {windows.length > 0 && <p className="section-note">No seu perfil aparece: <strong>Costuma responder {describeChatHours(windows)}</strong></p>}
      <ChatHoursForm windows={windows}/>
    </div>
  </DashboardShell>;
}
