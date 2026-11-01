// Server errors (ErrorEvent) explained for the team on /admin/status: what stopped working and
// what to do. Unknown errors get a generic sentence (the raw text is not shown: nobody reads it there).
type ErrorRow = { path: string; routeType: string; message: string };
export type ErrorText = { what: string; fix?: string; area: string };

const AREAS: [RegExp, string][] = [
  [/^\/auth\/google-agenda/, "Sincronizar Google Agenda"], [/^\/auth\/google-calendar/, "Adicionar ao Google Agenda"], [/^\/auth\/callback/, "Login e integrações Google"],
  [/^\/api\/cron/, "Tarefas automáticas"], [/^\/admin/, "Painel administrativo"], [/^\/consultor\/perfil/, "Perfil do consultor"], [/^\/consultor/, "Painel do consultor"],
  [/^\/dashboard/, "Painel do cliente"], [/^\/conversa/, "Chat da conversa"], [/^\/sala/, "Sala de vídeo"], [/^\/checkout|^\/agendar/, "Agendamento e pagamento"], [/^\/profissional/, "Perfil público"],
];

export function explainError(row: ErrorRow): ErrorText {
  const message = row.message ?? "";
  const area = AREAS.find(([pattern]) => pattern.test(row.path))?.[1] ?? (row.path === "/" ? "Página inicial" : "Site");
  if (/Calendar API has not been used|calendar-json\.googleapis\.com|SERVICE_DISABLED|accessNotConfigured/i.test(message)) return { area, what: "O Google Agenda está desligado no Google Cloud: a sincronização da agenda e o “adicionar ao calendário” não funcionam.", fix: "Ative a Google Calendar API no projeto do Google Cloud." };
  if (/no provider_token/i.test(message)) return { area, what: "O Google não devolveu a permissão da agenda depois do login.", fix: "Normalmente a pessoa desmarcou a permissão da agenda na tela do Google; basta tentar de novo." };
  if (/calendar_booking_not_available|calendar_booking_not_found/i.test(message)) return { area, what: "Alguém tentou adicionar ao Google Agenda uma conversa que não está mais confirmada." };
  if (/events\.insert (401|403)/i.test(message)) return { area, what: "O Google recusou criar o evento na agenda da pessoa (permissão negada).", fix: "A pessoa precisa autorizar o acesso à agenda novamente." };
  if (/invalid_grant/i.test(message)) return { area, what: "A conexão com o Google Meet expirou: as salas novas usam o Jitsi até ser renovada.", fix: "Gere um novo token do Google e atualize GOOGLE_REFRESH_TOKEN na Vercel." };
  if (/fetch failed|ECONNRESET|ETIMEDOUT|timeout/i.test(message)) return { area, what: "Um serviço externo demorou ou não respondeu.", fix: "Se repetir muito, confira o status do serviço (Supabase, Google, Stripe)." };
  if (/JWT|not_authorized|permission denied/i.test(message)) return { area, what: "Uma ação foi recusada por falta de permissão." };
  return { area, what: "Algo deu errado ao carregar ou salvar nesta área.", fix: "Se repetir, avise quem cuida do código." };
}
