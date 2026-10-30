import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// The admin action log stores compact internal details ("report:<id>", "FEATURE booking-35",
// "VERIFIED verification-3"). This turns them into a sentence a person understands, with a link
// to the thing the action was about when there is one.
export type LogRow = { action: string; detail: string | null };
export type LogText = { label: string; detail: string; href?: string };

const ACTIONS: Record<string, string> = { suspend: "Suspendeu conta", lift_suspension: "Encerrou suspensão", warn: "Registrou advertência", reveal_identity: "Consultou CPF completo", resolve_report: "Encerrou caso", review_verification: "Analisou comprovante", resolve_catalog: "Decidiu empresa/área", resolve_review_report: "Decidiu avaliação denunciada", review_story: "Decidiu história", note: "Adicionou nota interna", take_case: "Assumiu caso", delete_account: "Excluiu conta", reply_report: "Respondeu caso", report_in_review: "Pôs caso em análise" };
const STORY: Record<string, string> = { APPROVED: "Aceitou história", REJECTED: "Rejeitou história", PENDING: "Reconsiderou história", FEATURE: "Colocou história no ar", UNFEATURE: "Tirou história do ar" };
const CATALOG: Record<string, string> = { new: "Adicionou ao catálogo", existing: "Vinculou a um item existente", reject: "Recusou o pedido" };
const excerpt = (text: string, size = 70) => (text.length > size ? `${text.slice(0, size).trimEnd()}…` : text);

export async function describeAdminLog(rows: LogRow[]): Promise<LogText[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const reportIds = new Set<string>(), bookingIds = new Set<string>(), verificationIds = new Set<string>();
  for (const { action, detail } of rows) {
    const value = detail ?? "";
    if (action === "take_case") { const [kind, id] = value.split(":"); if (kind === "report") reportIds.add(id); else if (id) bookingIds.add(id); }
    if (["resolve_report", "reply_report", "report_in_review"].includes(action) && value) reportIds.add(value);
    if (action === "review_story") bookingIds.add(value.split(" ")[1] ?? "");
    if (action === "review_verification") verificationIds.add(value.split(" ")[1] ?? "");
  }
  const [{ data: reports }, { data: stories }, { data: verifications }] = await Promise.all([
    reportIds.size ? supabase.from("Report").select("id, category, targetUserId, bookingId").in("id", [...reportIds]) : { data: [] },
    bookingIds.size ? supabase.from("DecisionStory").select("bookingId, story").in("bookingId", [...bookingIds]) : { data: [] },
    verificationIds.size ? supabase.from("Verification").select("id, professionalProfile:ProfessionalProfile(user:User(name))").in("id", [...verificationIds]) : { data: [] },
  ]);
  const report = new Map(((reports ?? []) as { id: string; category: string; targetUserId: string | null; bookingId: string | null }[]).map((row) => [row.id, row]));
  const story = new Map(((stories ?? []) as { bookingId: string; story: string }[]).map((row) => [row.bookingId, row.story]));
  const consultant = new Map(((verifications ?? []) as { id: string; professionalProfile: { user: { name: string } | { name: string }[] | null } | { user: { name: string } | { name: string }[] | null }[] | null }[]).map((row) => {
    const profile = Array.isArray(row.professionalProfile) ? row.professionalProfile[0] : row.professionalProfile;
    const user = Array.isArray(profile?.user) ? profile?.user[0] : profile?.user;
    return [row.id, user?.name ?? "consultor"];
  }));
  const caseText = (id: string) => {
    const item = report.get(id);
    return item ? { detail: `${item.targetUserId || item.bookingId ? "Denúncia" : "Suporte"} · ${item.category}`, href: `/admin/casos/relato/${id}` } : { detail: "Caso removido" };
  };

  return rows.map(({ action, detail }): LogText => {
    const value = detail ?? "";
    const label = ACTIONS[action] ?? action;
    switch (action) {
      case "take_case": {
        const [kind, id] = value.split(":");
        if (kind === "report") return { label, ...caseText(id) };
        return { label, detail: kind === "dispute" ? "Contestação de uma conversa" : kind === "noshow" ? "Falta em uma conversa" : kind === "review" ? "Avaliação denunciada" : "Caso" };
      }
      case "resolve_report": case "reply_report": case "report_in_review": return { label, ...caseText(value) };
      case "review_story": {
        const [verb, bookingId] = value.split(" ");
        const text = story.get(bookingId ?? "");
        return { label: STORY[verb] ?? label, detail: text ? `“${excerpt(text)}”` : "", href: "/admin/historias" };
      }
      case "review_verification": {
        const [decision, id] = value.split(" ");
        return { label: decision === "VERIFIED" ? "Aprovou comprovante" : "Recusou comprovante", detail: `De ${consultant.get(id ?? "") ?? "consultor"}` };
      }
      case "resolve_catalog": {
        const match = value.match(/^(\w+) (COMPANY|PROFESSION): (.+)$/);
        if (!match) return { label, detail: "" };
        return { label: CATALOG[match[1]] ?? label, detail: `${match[2] === "COMPANY" ? "Empresa" : "Área"} “${match[3]}”`, href: "/admin/catalogo" };
      }
      case "resolve_review_report": return { label, detail: value.startsWith("REMOVED") ? "Avaliação removida do perfil" : "Avaliação mantida", href: "/admin/denuncias" };
      case "suspend": {
        const [duration, ...reason] = value.split(": ");
        const period = duration === "permanent" ? "Permanente" : /^\d+$/.test(duration) ? `${duration} dias` : duration;
        return { label: duration === "permanent" ? "Baniu conta" : label, detail: [period, reason.join(": ")].filter(Boolean).join(" · ") };
      }
      default: return { label, detail: value };
    }
  });
}
