import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { buildBrandedWorkbook, xlsxResponse, type SheetSection } from "@/lib/branded-sheet";

export const dynamic = "force-dynamic";

// LGPD art. 18 (access and portability): an Insidely spreadsheet (one tab per kind of data) with
// everything the platform keeps about the signed-in person; ?formato=json gives the same as JSON. Read with the service role, always scoped to the authenticated account.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const id = user.id;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("*, experiences:EmploymentExperience(*), privacy:PrivacySettings(*)").eq("userId", id).maybeSingle();
  const [account, identity, bookings, messages, reviews, favorites, notifications, feedback, accessLog, consultantBookings] = await Promise.all([
    supabase.from("User").select("id, name, email, role, image, createdAt, updatedAt, termsVersion, termsAcceptedAt, suspendedAt, suspendedUntil, suspensionReason").eq("id", id).maybeSingle(),
    supabase.from("CustomerIdentity").select("cpf, birthDate, createdAt").eq("userId", id).maybeSingle(),
    supabase.from("Booking").select("id, status, startsAt, durationMinutes, topics, goals, totalCents, createdAt").eq("customerId", id),
    supabase.from("Message").select("id, conversationId, body, createdAt, readAt").eq("senderId", id),
    supabase.from("Review").select("id, bookingId, rating, comment, createdAt").eq("userId", id),
    supabase.from("Favorite").select("professionalProfileId, createdAt").eq("userId", id),
    supabase.from("Notification").select("title, body, createdAt, readAt").eq("userId", id),
    supabase.from("CustomerFeedback").select("rating, comment, createdAt").eq("customerId", id),
    supabase.from("AccessLog").select("ip, userAgent, method, createdAt").eq("userId", id).order("createdAt", { ascending: false }),
    profile ? supabase.from("Booking").select("id, status, startsAt, durationMinutes, topics, goals, totalCents, feeCents, createdAt").eq("professionalProfileId", profile.id) : Promise.resolve({ data: [] }),
  ]);
  const body = {
    geradoEm: new Date().toISOString(),
    aviso: "Cópia dos seus dados guardados pela Insidely (LGPD, art. 18). Senhas não são guardadas em texto e não aparecem aqui.",
    conta: account.data, identificacao: identity.data, agendamentosComoCliente: bookings.data, mensagensEnviadas: messages.data,
    avaliacoesFeitas: reviews.data, favoritos: favorites.data, notificacoes: notifications.data, avaliacoesRecebidasComoCliente: feedback.data,
    perfilDeConsultor: profile, agendamentosComoConsultor: consultantBookings.data, registrosDeAcesso: accessLog.data,
  };
  if (new URL(request.url).searchParams.get("formato") === "json") return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="insidely-meus-dados.json"`, "Cache-Control": "private, no-store" } });
  const status: Record<string, string> = { PENDING_PAYMENT: "Aguardando pagamento", CONFIRMED: "Confirmada", AWAITING_CONFIRMATION: "Realizada", COMPLETED_RELEASE_PENDING: "Concluída", COMPLETED: "Concluída", DISPUTED: "Em análise", CANCELLED: "Cancelada", EXPIRED: "Expirada", NO_SHOW: "Falta", IN_PROGRESS: "Em andamento" };
  type Row = Record<string, unknown>;
  const list = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []) as Row[];
  const bookingRows = (rows: unknown) => list(rows).map((row) => ({ ...row, status: status[String(row.status)] ?? row.status, topics: Array.isArray(row.topics) ? row.topics.join(", ") : row.topics }));
  const bookingColumns = [{ header: "Data", key: "startsAt", type: "date" as const }, { header: "Duração (min)", key: "durationMinutes", type: "number" as const, width: 14 }, { header: "Situação", key: "status", width: 20 }, { header: "Temas", key: "topics", width: 30 }, { header: "O que queria conversar", key: "goals", width: 50 }, { header: "Valor total", key: "totalCents", type: "money" as const }, { header: "Pedido em", key: "createdAt", type: "date" as const }];
  const accountRow = list(body.conta)[0] ?? {};
  const consultant = (body.perfilDeConsultor ?? null) as Row | null;
  const sections: SheetSection[] = [
    { name: "Conta", columns: [{ header: "Dado", key: "label", width: 30 }, { header: "Valor", key: "value", width: 60 }], rows: [
      { label: "Nome", value: accountRow.name }, { label: "E-mail", value: accountRow.email }, { label: "Tipo de conta", value: accountRow.role === "CONSULTANT" ? "Consultor" : accountRow.role === "ADMIN" ? "Administração" : "Cliente" },
      { label: "Conta criada em", value: accountRow.createdAt ? new Date(String(accountRow.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "" },
      { label: "Termos aceitos (versão)", value: accountRow.termsVersion }, { label: "CPF", value: list(body.identificacao)[0]?.cpf }, { label: "Data de nascimento", value: list(body.identificacao)[0]?.birthDate },
      { label: "Observação", value: body.aviso },
    ] },
    { name: "Agendamentos", columns: bookingColumns, rows: bookingRows(body.agendamentosComoCliente), empty: "Você ainda não agendou conversas." },
    ...(consultant ? [
      { name: "Perfil de consultor", columns: [{ header: "Dado", key: "label", width: 30 }, { header: "Valor", key: "value", width: 70 }], rows: [
        { label: "Título", value: consultant.headline }, { label: "Apresentação", value: consultant.bio }, { label: "Cidade", value: consultant.location },
        { label: "Valor 30 min", value: consultant.price30Cents ? `R$ ${(Number(consultant.price30Cents) / 100).toFixed(2).replace(".", ",")}` : "" },
        { label: "Valor 60 min", value: consultant.price60Cents ? `R$ ${(Number(consultant.price60Cents) / 100).toFixed(2).replace(".", ",")}` : "" },
        { label: "Chave Pix", value: consultant.pixKey },
      ] },
      { name: "Experiências", columns: [{ header: "Cargo", key: "title" }, { header: "Ainda trabalha lá", key: "current", width: 16 }, { header: "Entrada", key: "startedAt", type: "date" as const }, { header: "Saída", key: "endedAt", type: "date" as const }, { header: "O que faz ou fazia", key: "summary", width: 50 }], rows: list(consultant.experiences).map((row) => ({ ...row, current: row.isCurrent ? "Sim" : "Não" })) },
      { name: "Conversas atendidas", columns: [...bookingColumns, { header: "Taxa Insidely", key: "feeCents", type: "money" as const }], rows: bookingRows(body.agendamentosComoConsultor), empty: "Nenhuma conversa atendida ainda." },
    ] : []),
    { name: "Mensagens enviadas", columns: [{ header: "Enviada em", key: "createdAt", type: "date" }, { header: "Mensagem", key: "body", width: 70 }, { header: "Lida em", key: "readAt", type: "date" }], rows: list(body.mensagensEnviadas), empty: "Nenhuma mensagem enviada." },
    { name: "Avaliações", columns: [{ header: "Feita em", key: "createdAt", type: "date" }, { header: "Nota", key: "rating", type: "number", width: 10 }, { header: "Comentário", key: "comment", width: 60 }], rows: list(body.avaliacoesFeitas), empty: "Nenhuma avaliação feita." },
    { name: "Avaliações recebidas", columns: [{ header: "Recebida em", key: "createdAt", type: "date" }, { header: "Nota", key: "rating", type: "number", width: 10 }, { header: "Comentário", key: "comment", width: 60 }], rows: list(body.avaliacoesRecebidasComoCliente), empty: "Nenhuma avaliação recebida." },
    { name: "Notificações", columns: [{ header: "Data", key: "createdAt", type: "date" }, { header: "Título", key: "title", width: 30 }, { header: "Texto", key: "body", width: 60 }, { header: "Lida em", key: "readAt", type: "date" }], rows: list(body.notificacoes), empty: "Nenhuma notificação." },
    { name: "Acessos", columns: [{ header: "Data", key: "createdAt", type: "date" }, { header: "Endereço IP", key: "ip", width: 18 }, { header: "Forma de entrada", key: "method", width: 18 }, { header: "Navegador", key: "userAgent", width: 60 }], rows: list(body.registrosDeAcesso), empty: "Nenhum acesso registrado." },
  ];
  return xlsxResponse(await buildBrandedWorkbook({ title: "Seus dados", subtitle: String(accountRow.name ?? ""), sections }), "insidely-meus-dados.xlsx");
}
