import Link from "next/link";
import { notFound } from "next/navigation";
import { addAdminNoteAction, adminDeleteAccountAction, liftSuspensionAction, revealIdentityAction, suspendUserAction, warnUserAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate, visibleEmail } from "@/lib/format";
import { ageOn, formatCpf, maskCpf } from "@/lib/identity";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getStaffRatings, SUPPORT_RATINGS, supportRatingLabel } from "@/lib/support-threads";

export const metadata = { title: "Usuário" };
export const dynamic = "force-dynamic";

const when = (value: string) => shortDate(parseDbDate(value));
const ROLE_LABELS: Record<string, string> = { USER: "Cliente", CONSULTANT: "Consultor", ADMIN: "Administrador", SUPPORT: "Suporte" };
// A recorded CPF access stays valid for 10 minutes.
const revealWindowStart = () => new Date(Date.now() - 10 * 60_000).toISOString();

type Audit = { id: string; adminUserId: string; reason: string; createdAt: string };
type ReportRow = { id: string; category: string; description: string; status: string; createdAt: string };
type ModerationRow = { reason: string; excerpt: string; createdAt: string };
type FeedbackRow = { rating: number; comment: string | null; createdAt: string };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ acao?: string; ok?: string; erro?: string; acesso?: string; canceladas?: string; falhas?: string }> }) {
  const admin = await requireUser([Role.ADMIN]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Trust and safety tables are added by migrations beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: user } = await supabase.from("User").select("id, name, email, role, createdAt, auth_user_id, suspendedAt, suspendedUntil, suspensionReason").eq("id", id).maybeSingle();
  if (!user) notFound();
  const [identity, audits, reactivations, moderation, reportsAgainst, feedback, bookings, warnings, notes, reveal] = await Promise.all([
    supabase.from("CustomerIdentity").select("cpf, birthDate, createdAt").eq("userId", id).maybeSingle(),
    supabase.from("IdentityAccessAudit").select("id, adminUserId, reason, createdAt").eq("targetUserId", id).order("createdAt", { ascending: false }).limit(20),
    supabase.from("AccountReactivationAudit").select("createdAt").eq("userId", id),
    supabase.from("ChatModerationEvent").select("reason, excerpt, createdAt").eq("userId", id).order("createdAt", { ascending: false }).limit(10),
    supabase.from("Report").select("id, category, description, status, createdAt").eq("targetUserId", id).order("createdAt", { ascending: false }).limit(10),
    supabase.from("CustomerFeedback").select("rating, comment, createdAt").eq("customerId", id).order("createdAt", { ascending: false }),
    supabase.from("Booking").select("id", { count: "exact", head: true }).eq("customerId", id),
    supabase.from("AccountWarning").select("id, reason, createdAt").eq("userId", id).order("createdAt", { ascending: false }),
    supabase.from("AdminNote").select("id, body, createdAt, adminUserId").eq("userId", id).order("createdAt", { ascending: false }),
    // The full CPF shows only for the access this admin just recorded, for 10 minutes.
    query.acesso
      ? supabase.from("IdentityAccessAudit").select("id").eq("id", query.acesso).eq("adminUserId", admin.id).eq("targetUserId", id).gte("createdAt", revealWindowStart()).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const auditRows = (audits.data ?? []) as Audit[];
  const adminIds = [...new Set(auditRows.map((item) => item.adminUserId))];
  const { data: admins } = adminIds.length ? await supabase.from("User").select("id, name").in("id", adminIds) : { data: [] };
  const adminName = (adminId: string) => ((admins ?? []) as { id: string; name: string }[]).find((item) => item.id === adminId)?.name ?? "Admin";
  const suspended = Boolean(user.suspendedAt) && (!user.suspendedUntil || parseDbDate(user.suspendedUntil) > new Date());
  const ratings = (feedback.data ?? []) as FeedbackRow[];
  const average = ratings.length ? (ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length).toFixed(1) : null;
  const moderationRows = (moderation.data ?? []) as ModerationRow[];
  const reportRows = (reportsAgainst.data ?? []) as ReportRow[];
  const reactivationCount = reactivations.data?.length ?? 0;
  // Admins are staff, not customers or consultants: no reputation, warnings or identity record.
  const isAdmin = user.role === Role.ADMIN;
  const warningRows = (warnings.data ?? []) as { id: string; reason: string; createdAt: string }[];
  // Staff (admins and support) are rated by the people whose cases they closed.
  const service = user.role === Role.ADMIN || user.role === Role.SUPPORT ? await getStaffRatings(user.id) : null;

  return <DashboardShell mode="admin" title={user.name}>
    {query.ok && <p className="form-feedback" role="status">{query.ok === "advertida" ? "Advertência registrada e enviada à pessoa." : query.ok === "suspensa" ? `Conta suspensa.${Number(query.canceladas) > 0 ? ` ${query.canceladas} conversa(s) futura(s) cancelada(s) com reembolso integral; os clientes foram avisados.` : ""}` : "Suspensão encerrada."}</p>}
    {query.erro && <p className="form-error" role="alert">{query.erro}</p>}
    {Number(query.falhas) > 0 && <p className="form-error" role="alert">{query.falhas} conversa(s) não puderam ser canceladas automaticamente. Cancele pela lista de consultas do consultor ou contate o suporte de pagamentos.</p>}
    <div className="profile-management-stack">
      <p className="case-back"><Link className="text-link" href="/admin/usuarios">← Usuários</Link></p>
      <section className="panel account-head">
        <div className="account-head-top">
          <div><h2>{user.name}</h2><p className="muted">{visibleEmail(user.email) ?? "E-mail removido com a exclusão da conta"}</p></div>
          <div className="account-head-tags"><span className="status">{ROLE_LABELS[user.role] ?? user.role}</span>{!user.auth_user_id && <span className="status">Conta excluída</span>}</div>
        </div>
        <small className="muted">Conta criada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(parseDbDate(user.createdAt))}</small>
        {/* Staff accounts do not book conversations: no customer numbers. */}
        {!isAdmin && user.role !== Role.SUPPORT && <dl className="account-stats">
          <div><dt>Agendamentos como cliente</dt><dd>{bookings.count ?? 0}</dd></div>
          <div><dt>Denúncias recebidas</dt><dd>{reportRows.length}</dd></div>
          <div><dt>Mensagens bloqueadas</dt><dd>{moderationRows.length}</dd></div>
          <div><dt>Nota como cliente</dt><dd>{average ? <>{average.replace(".", ",")} <small>({ratings.length})</small></> : "—"}</dd></div>
          {reactivationCount > 0 && <div><dt>Reativações pelo CPF</dt><dd>{reactivationCount}</dd></div>}
        </dl>}
      </section>

      {service && <section className="panel form-stack" id="avaliacoes-suporte">
        <span className="eyebrow">Avaliações do atendimento · só administradores veem</span>
        {service.average === null ? <p className="muted">Nenhuma avaliação ainda. Quem abriu um caso pode avaliar o atendimento depois que ele é encerrado.</p> : <>
          <div className="staff-rating-summary">
            <div><strong>{service.average.toFixed(1).replace(".", ",")}</strong><span className="muted">de 3 · {service.ratings.length} {service.ratings.length === 1 ? "avaliação" : "avaliações"}</span></div>
            <div className="staff-rating-bars">{[...SUPPORT_RATINGS].reverse().map((item) => <div key={item.value}><span>{item.label}</span><span className="staff-rating-bar"><span style={{ width: `${(service.counts[item.value] / service.ratings.length) * 100}%` }}/></span><span>{service.counts[item.value]}</span></div>)}</div>
          </div>
          <p className="muted">Ruim vale 1, Bom vale 2 e Ótimo vale 3.</p>
          <div className="list">{service.ratings.map((row) => <div className="list-row" key={row.id}><div><strong>{supportRatingLabel(row.rating)}</strong> · <Link className="text-link" href={`/admin/casos/relato/${row.reportId}`}>{row.category}</Link>{row.comment && <p>“{row.comment}”</p>}</div><span className="muted">{when(row.createdAt)}</span></div>)}</div>
        </>}
      </section>}

      <section className="panel form-stack" id="notas">
        <span className="eyebrow">Notas internas · só a equipe vê</span>
        {((notes.data ?? []) as { id: string; body: string; createdAt: string }[]).map((note) => <div className="list-row" key={note.id}><p>{note.body}</p><span className="muted">{when(note.createdAt)}</span></div>)}
        <form action={addAdminNoteAction.bind(null, user.id)} className="form-stack"><textarea className="textarea" name="body" minLength={2} maxLength={2000} required placeholder="Ex.: Ligou para o suporte em 30/10 contestando a denúncia; pediu revisão."/><button className="button button-ghost button-sm">Adicionar nota</button></form>
      </section>

      {!isAdmin && <section className="panel form-stack">
        <span className="eyebrow">Advertências · {warningRows.length}</span>
        <p className="muted">Próximo passo sugerido: <strong>{suspended ? "aguardar o fim da suspensão" : warningRows.length === 0 ? "advertência" : warningRows.length === 1 ? "suspensão de 7 dias" : warningRows.length === 2 ? "suspensão de 30 dias" : "banimento"}</strong>, conforme o histórico desta conta.</p>
        {warningRows.length > 0 && <div className="list">{warningRows.map((item) => <div className="list-row" key={item.id}><p>{item.reason}</p><span className="muted">{when(item.createdAt)}</span></div>)}</div>}
        {user.role !== Role.ADMIN && <form action={warnUserAction.bind(null, user.id)} className="form-stack"><label className="field"><span>Nova advertência (a pessoa recebe por e-mail e notificação)</span><textarea className="textarea" name="reason" minLength={10} maxLength={500} required/></label><button className="button button-ghost button-sm" type="submit">Registrar advertência</button></form>}
      </section>}

      <section className="panel form-stack" id="suspensao">
        <span className="eyebrow">Suspensão</span>
        {suspended ? <>
          <h2>Suspensa {user.suspendedUntil ? `até ${when(user.suspendedUntil)}` : "permanentemente"}</h2>
          <p className="muted">Motivo: {user.suspensionReason}</p>
          <form action={liftSuspensionAction.bind(null, user.id)}><button className="button button-dark button-sm" type="submit">Encerrar suspensão</button></form>
        </> : user.role === Role.ADMIN ? <p className="muted">Contas de administrador não podem ser suspensas por aqui.</p> : <form action={suspendUserAction.bind(null, user.id)} className="form-stack">
          <p className="muted">A conta fica sem acesso ao painel, não agenda, não recebe agendamentos e não envia mensagens. O perfil de consultor sai da busca e as conversas futuras já agendadas com ele são canceladas, com reembolso integral aos clientes. A suspensão continua valendo se a pessoa excluir a conta e voltar com o mesmo CPF.</p>
          <label className="field"><span>Duração</span><select className="select" name="duration" defaultValue={query.acao === "banir" ? "permanent" : "7"}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="permanent">Permanente (banimento)</option></select></label>
          <label className="field"><span>Motivo (aparece para a pessoa)</span><textarea className="textarea" name="reason" minLength={10} maxLength={500} required/></label>
          <button className="button button-danger button-sm" type="submit">Suspender conta</button>
        </form>}
      </section>

      {!isAdmin && <section className="panel form-stack">
        <span className="eyebrow">Identificação · todo acesso é registrado</span>
        {!identity.data ? <p className="muted">Esta conta ainda não registrou CPF.</p> : reveal.data ? <div className="customer-info"><dl>
          <div><dt>CPF</dt><dd>{formatCpf(identity.data.cpf)}</dd></div>
          <div><dt>Nascimento</dt><dd>{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${identity.data.birthDate}T00:00:00Z`))} ({ageOn(identity.data.birthDate)} anos)</dd></div>
          <div><dt>Registrado em</dt><dd>{when(identity.data.createdAt)}</dd></div>
        </dl><p className="muted">Este acesso foi registrado em seu nome. Depois de 10 minutos, recarregar a página volta a esconder os dados.</p></div> : <>
          <p>CPF {maskCpf(identity.data.cpf)}</p>
          <form action={revealIdentityAction.bind(null, user.id)} className="form-stack">
            <label className="field"><span>Motivo do acesso ao CPF completo</span><textarea className="textarea" name="reason" minLength={15} maxLength={500} required placeholder="Ex.: Ofício nº 123/2026 da Delegacia de Crimes Cibernéticos, recebido em 29/10/2026."/></label>
            <button className="button button-dark button-sm" type="submit">Registrar motivo e ver CPF completo</button>
          </form>
        </>}
        {auditRows.length > 0 && <><strong>Histórico de acessos</strong><div className="list">{auditRows.map((item) => <div className="list-row" key={item.id}><div><strong>{adminName(item.adminUserId)}</strong><p className="muted">{item.reason}</p></div><span className="muted">{when(item.createdAt)}</span></div>)}</div></>}
      </section>}

      {!isAdmin && <section className="panel"><span className="eyebrow">Denúncias recebidas</span><div className="list">{reportRows.map((item) => <div className="list-row" key={item.id}><div><strong>{item.category}</strong><p className="muted">{item.description}</p></div><span className="status">{item.status} · {when(item.createdAt)}</span></div>)}{!reportRows.length && <p className="muted">Nenhuma denúncia.</p>}</div></section>}

      {!isAdmin && <section className="panel"><span className="eyebrow">Mensagens bloqueadas no chat</span><div className="list">{moderationRows.map((item, index) => <div className="list-row" key={index}><div><strong>{item.reason === "offensive" ? "Ofensiva" : "Contato / pagamento por fora"}</strong><p className="muted">“{item.excerpt}”</p></div><span className="muted">{when(item.createdAt)}</span></div>)}{!moderationRows.length && <p className="muted">Nenhuma.</p>}</div></section>}

      {!isAdmin && <section className="panel"><span className="eyebrow">Avaliações dadas pelos consultores</span><div className="list">{ratings.map((item, index) => <div className="list-row" key={index}><div><strong>★ {item.rating}</strong>{item.comment && <p className="muted">{item.comment}</p>}</div><span className="muted">{when(item.createdAt)}</span></div>)}{!ratings.length && <p className="muted">Nenhuma avaliação.</p>}</div></section>}
      {!isAdmin && user.auth_user_id && <section className="panel form-stack admin-danger" id="excluir">
        <span className="eyebrow">Excluir conta</span>
        <p className="muted">Remove o acesso, as fotos e o perfil público. O CPF e o histórico ficam guardados pelo prazo legal, e a pessoa só volta reativando esta mesma conta. Não é possível com conversas pendentes, marcadas ou em análise.</p>
        <form action={adminDeleteAccountAction.bind(null, user.id)} className="form-stack">
          <label className="field"><span>Motivo (fica no registro de ações)</span><textarea className="textarea" name="reason" minLength={10} maxLength={500} required/></label>
          <label className="field"><span>Para confirmar, digite o e-mail da conta: {user.email}</span><input className="input" name="confirmation" type="email" required autoComplete="off"/></label>
          <button className="button button-danger button-sm" type="submit">Excluir conta definitivamente</button>
        </form>
      </section>}
    </div>
  </DashboardShell>;
}
