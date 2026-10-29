import nodemailer from "nodemailer";
import { getAppUrl } from "./app-url";
import { buildConversationIcs } from "./calendar";
import { parseDbDate } from "./format";

type BookingRecipient = { email: string; name: string };

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character); }

// Resend's branded sender takes precedence; SMTP delivers when Resend is missing or rejects a message.
export const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const resendConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
const emailConfigured = () => process.env.E2E_MOCK_EXTERNALS === "true" || smtpConfigured() || resendConfigured();
// Whether sendTransactionalEmail can actually deliver: same precedence as its transports below.
// Sign-up and recovery use this to send their own links instead of Supabase's built-in mailer.
export const appEmailConfigured = () => process.env.E2E_MOCK_EXTERNALS === "true" || resendConfigured() || smtpConfigured();

// Built once per server instance; each message still opens its own connection.
let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function smtpTransport() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT?.trim() || 465);
  transport = nodemailer.createTransport({ host: process.env.SMTP_HOST?.trim(), port, secure: port === 465, auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS?.replace(/\s/g, "") } });
  return transport;
}

// Branded layout shared by every e-mail: table-based with inline styles, the only thing every mail client renders.
const emailButton = (href: string, label: string) => `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#ff7657;color:#172033;font-weight:800;text-decoration:none">${label}</a>`;
export function renderEmailLayout(content: string) {
  const appUrl = getAppUrl();
  const body = content
    .replace(/<p>/g, '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#172033">')
    .replace(/<a href="([^"]*)">/g, '<a href="$1" style="color:#c2412a;font-weight:700">');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;padding:0;background:#f7f2e8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2e8;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<tr><td style="padding:0 8px 18px;font:800 26px/1 Arial Rounded MT Bold,Nunito,Helvetica,Arial,sans-serif;letter-spacing:-1px;color:#172033">insidely<span style="color:#ff7657">.</span></td></tr>
<tr><td style="padding:32px 28px;background:#ffffff;border:1px solid #e4dccd;border-radius:22px">${body}</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.5;color:#667085">Você recebeu este e-mail porque tem uma conta ou fez um pedido na Insidely.<br><a href="${escapeHtml(appUrl)}" style="color:#667085">${escapeHtml(appUrl.replace(/^https?:\/\//, ""))}</a> · <a href="${escapeHtml(appUrl + "/suporte")}" style="color:#667085">Suporte</a></td></tr>
</table></td></tr></table></body></html>`;
}
// Plain-text alternative: improves deliverability and serves clients that block HTML.
export function emailText(content: string) {
  return content
    .replace(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g, (_, href: string, label: string) => label.trim() === href ? href : `${label} (${href})`)
    .replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export async function sendTransactionalEmail({ to, subject, html: content, ics }: { to: string; subject: string; html: string; ics?: string }) {
  if (process.env.E2E_MOCK_EXTERNALS === "true") return true;
  const html = renderEmailLayout(content), text = emailText(content);
  // Prefer the branded Resend sender. If Resend rejects the message (e.g. its sender domain is not
  // verified yet), fall back to SMTP so sign-up and booking e-mails still reach people.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (apiKey && from) {
    const attachments = ics ? [{ filename: "conversa-insidely.ics", content: Buffer.from(ics).toString("base64") }] : undefined;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html, text, attachments }), cache: "no-store" });
    if (response.ok) return true;
    // Resend explains rejections (e.g. unverified sender domain) in the body; keep it for the logs.
    const resendError = new Error(`Resend failed: ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    if (!smtpConfigured()) throw resendError;
    console.error("resend_failed_using_smtp", resendError.message);
  }
  if (smtpConfigured()) {
    // Recipients see "Insidely" as the sender name, whatever account authenticates the SMTP connection.
    const smtpFrom = (process.env.SMTP_FROM || process.env.SMTP_USER || "").match(/<([^>]+)>/)?.[1] || process.env.SMTP_FROM || process.env.SMTP_USER || "";
    await smtpTransport().sendMail({ from: { name: "Insidely", address: smtpFrom.trim() }, to, subject, html, text, ...(ics ? { icalEvent: { filename: "conversa-insidely.ics", method: "PUBLISH", content: ics } } : {}) });
    return true;
  }
  return false;
}

// Confirmation (right after payment) and reminder (about an hour before) for both participants,
// with the room link, date/time, a shortcut to the booking chat and a calendar invite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendBookingRoomEmails(supabase: any, bookingId: string, kind: "confirmation" | "reminder") {
  if (!emailConfigured()) return;
  const { data: booking, error } = await supabase.from("Booking").select("id, startsAt, durationMinutes, goals, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (error || !booking) throw new Error(`booking_email_lookup: ${error?.message ?? "not_found"}`);
  const { data: customer } = await supabase.from("User").select("email, name").eq("id", booking.customerId).maybeSingle();
  const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
  const { data: consultant } = profile ? await supabase.from("User").select("email, name").eq("id", profile.userId).maybeSingle() : { data: null };
  const { data: publicProfile } = await supabase.from("public_profile_cards").select("user").eq("id", booking.professionalProfileId).maybeSingle();
  const consultantPublicName = (Array.isArray(publicProfile?.user) ? publicProfile.user[0]?.name : (publicProfile?.user as { name?: string } | null)?.name) || "a pessoa da comunidade";
  const startsAt = parseDbDate(booking.startsAt);
  const date = startsAt.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const time = startsAt.toLocaleString("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const appUrl = getAppUrl();
  // Share the schedule-checked Insidely room link; the raw Meet link would work at any time.
  const roomUrl = `${appUrl}/sala/${booking.id}`;
  const ics = buildConversationIcs({ id: booking.id, startsAt, durationMinutes: booking.durationMinutes, goals: booking.goals, roomUrl });
  const room = `<p><strong>Link da sala:</strong> <a href="${escapeHtml(roomUrl)}">${escapeHtml(roomUrl)}</a></p><p>A sala do Google Meet só é liberada no horário marcado e é encerrada ao fim da conversa (é preciso estar logado na Insidely).</p>`;
  const recipients = [
    customer?.email ? { email: customer.email, name: customer.name, with: consultantPublicName, chat: "/dashboard/mensagens" } : null,
    consultant?.email ? { email: consultant.email, name: consultant.name, with: customer?.name || "seu cliente", chat: "/consultor/consultas" } : null,
  ].filter((recipient): recipient is BookingRecipient & { with: string; chat: string } => Boolean(recipient)).filter((recipient, index, list) => list.findIndex((item) => item.email === recipient.email) === index);
  for (const recipient of recipients) {
    const subject = kind === "confirmation" ? "Sua conversa na Insidely foi confirmada" : `Lembrete: sua conversa na Insidely começa às ${time}`;
    const intro = kind === "confirmation" ? `Sua conversa com ${escapeHtml(recipient.with)} foi confirmada.` : `Sua conversa com ${escapeHtml(recipient.with)} começa em breve.`;
    await sendTransactionalEmail({ to: recipient.email, subject, ics: kind === "confirmation" ? ics : undefined, html: `<p>Olá, ${escapeHtml(recipient.name || "!")}</p><p>${intro}</p><p><strong>Quando:</strong> ${escapeHtml(date)} (horário de Brasília), ${booking.durationMinutes} minutos.</p>${room}<p>${emailButton(appUrl + recipient.chat, "Abrir o chat da conversa")}</p>${kind === "confirmation" ? "<p>O convite em anexo adiciona a conversa à sua agenda, com aviso 30 minutos antes.</p>" : ""}` });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBookingConfirmationEmails(supabase: any, bookingId: string) {
  await sendBookingRoomEmails(supabase, bookingId, "confirmation");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBookingReminderEmails(supabase: any, bookingId: string) {
  await sendBookingRoomEmails(supabase, bookingId, "reminder");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendPaymentInstructionsEmail(supabase: any, bookingId: string, checkoutUrl: string) {
  if (!emailConfigured()) return;
  const { data: booking, error } = await supabase.from("Booking").select("startsAt, durationMinutes, totalCents, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (error || !booking) throw new Error(`payment_email_lookup: ${error?.message ?? "not_found"}`);
  const { data: customer } = await supabase.from("User").select("email, name").eq("id", booking.customerId).maybeSingle();
  if (!customer?.email) return;
  const { data: publicProfile } = await supabase.from("public_profile_cards").select("user").eq("id", booking.professionalProfileId).maybeSingle();
  const professionalUser = Array.isArray(publicProfile?.user) ? publicProfile.user[0] : publicProfile?.user;
  const date = parseDbDate(booking.startsAt).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  // The checkout is a simulation: never e-mail a real Pix code that someone could actually pay.
  await sendTransactionalEmail({ to: customer.email, subject: "Finalize o pagamento da sua conversa na Insidely", html: `<p>Olá, ${escapeHtml(customer.name || "!")}</p><p>Sua conversa com ${escapeHtml(professionalUser?.name || "o consultor")} está reservada para <strong>${escapeHtml(date)}</strong>, com duração de ${booking.durationMinutes} minutos.</p><p><a href="${escapeHtml(checkoutUrl)}">Abrir checkout</a></p><p>O pagamento desta versão é demonstrativo e nenhum valor é cobrado. A conversa é liberada assim que o pagamento for confirmado no checkout.</p>` });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBookingCancellationEmail(supabase: any, bookingId: string, reason: string, refunded: boolean) {
  if (!emailConfigured()) return;
  const { data: booking, error } = await supabase.from("Booking").select("startsAt, durationMinutes, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (error || !booking) throw new Error(`cancellation_email_lookup: ${error?.message ?? "not_found"}`);
  const { data: customer } = await supabase.from("User").select("email, name").eq("id", booking.customerId).maybeSingle();
  if (!customer?.email) return;
  const professional = Array.isArray(booking.professional) ? booking.professional[0] : booking.professional;
  const professionalUser = Array.isArray(professional?.user) ? professional.user[0] : professional?.user;
  const date = parseDbDate(booking.startsAt).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const refundMessage = refunded ? "O reembolso integral foi solicitado ao meio de pagamento utilizado. O prazo para aparecer na sua conta depende da instituição financeira." : "Como o pagamento ainda não havia sido confirmado, não houve cobrança concluída.";
  await sendTransactionalEmail({ to: customer.email, subject: "Sua conversa na Insidely foi cancelada", html: `<p>Olá, ${escapeHtml(customer.name || "!")}</p><p>O consultor ${escapeHtml(professionalUser?.name || "responsável pela conversa")} precisou cancelar a conversa marcada para <strong>${escapeHtml(date)}</strong>.</p><p><strong>Motivo informado:</strong> ${escapeHtml(reason)}</p><p>${refundMessage}</p><p>Você pode voltar à plataforma para escolher outro profissional e horário.</p>` });
}

// Sign-up confirmation and password recovery links, sent through the app's own mail transport.
export async function sendAuthLinkEmail({ to, name, kind, link }: { to: string; name: string; kind: "signup" | "recovery"; link: string }) {
  const copy = kind === "signup"
    ? { subject: "Confirme seu cadastro na Insidely", intro: "Falta só um passo para ativar sua conta.", action: "Confirmar meu e-mail" }
    : { subject: "Redefina sua senha da Insidely", intro: "Recebemos um pedido para criar uma nova senha.", action: "Criar nova senha" };
  const sent = await sendTransactionalEmail({ to, subject: copy.subject, html: `<p>Olá, ${escapeHtml(name || "!")}</p><p>${copy.intro}</p><p>${emailButton(link, copy.action)}</p><p>Se você não fez esse pedido, ignore este e-mail.</p>` });
  if (!sent) throw new Error("auth_email_transport_unavailable");
}

// Sent when someone tries to sign up with an address that already has an account. The sign-up screen
// answers the same way for every address, so only the inbox owner learns that the account exists.
export async function sendExistingAccountEmail({ to, google }: { to: string; google: boolean }) {
  const appUrl = getAppUrl();
  const howToEnter = google
    ? `<p>Sua conta foi criada com o Google. Para entrar, use o botão <strong>Google</strong> em <a href="${escapeHtml(appUrl + "/entrar")}">${escapeHtml(appUrl + "/entrar")}</a>.</p>`
    : `<p>${emailButton(appUrl + "/entrar", "Entrar na minha conta")}</p><p>Não lembra a senha? <a href="${escapeHtml(appUrl + "/recuperar-senha")}">Crie uma nova</a>.</p>`;
  const sent = await sendTransactionalEmail({ to, subject: "Você já tem uma conta na Insidely", html: `<p>Olá!</p><p>Alguém tentou criar uma conta na Insidely com este e-mail, mas ele já está cadastrado.</p>${howToEnter}<p>Se não foi você, pode ignorar este e-mail: nada mudou na sua conta.</p>` });
  if (!sent) throw new Error("auth_email_transport_unavailable");
}

export async function sendEmailChangeConfirmation({ to, name, link }: { to: string; name: string; link: string }) {
  const sent = await sendTransactionalEmail({ to, subject: "Confirme seu novo e-mail na Insidely", html: `<p>Olá, ${escapeHtml(name || "!")}</p><p>Você pediu para usar este endereço na sua conta Insidely. Confirme para concluir a troca. O link vale por 1 hora e funciona com você conectado na sua conta.</p><p>${emailButton(link, "Confirmar novo e-mail")}</p><p>Se você não fez esse pedido, ignore este e-mail.</p>` });
  if (!sent) throw new Error("auth_email_transport_unavailable");
}

// Goes to the previous address after a change, so the owner notices a change they did not make.
export async function sendEmailChangedNotice({ to, newEmail }: { to: string; newEmail: string }) {
  const masked = newEmail.replace(/^(.)[^@]*(@.*)$/, "$1•••$2");
  await sendTransactionalEmail({ to, subject: "O e-mail da sua conta Insidely foi alterado", html: `<p>Olá!</p><p>O e-mail da sua conta Insidely foi trocado para <strong>${escapeHtml(masked)}</strong>. A partir de agora, use o novo endereço para entrar.</p><p>Não foi você? Fale com o suporte imediatamente: <a href="${escapeHtml(getAppUrl() + "/suporte")}">${escapeHtml(getAppUrl() + "/suporte")}</a>.</p>` });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendCustomerCancellationEmail(supabase: any, bookingId: string, reason: string) {
  if (!emailConfigured()) return;
  const { data: booking, error } = await supabase.from("Booking").select("startsAt, durationMinutes, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (error || !booking) throw new Error(`customer_cancellation_email_lookup: ${error?.message ?? "not_found"}`);
  const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
  const { data: consultant } = profile ? await supabase.from("User").select("email, name").eq("id", profile.userId).maybeSingle() : { data: null };
  const { data: customer } = await supabase.from("User").select("name").eq("id", booking.customerId).maybeSingle();
  if (!consultant?.email || profile?.userId === booking.customerId) return;
  const date = parseDbDate(booking.startsAt).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const why = reason ? `<p><strong>Motivo informado:</strong> ${escapeHtml(reason)}</p>` : "";
  await sendTransactionalEmail({ to: consultant.email, subject: "Uma conversa na Insidely foi cancelada pelo cliente", html: `<p>Olá, ${escapeHtml(consultant.name || "!")}</p><p>${escapeHtml(customer?.name || "O cliente")} cancelou a conversa marcada para <strong>${escapeHtml(date)}</strong> (${booking.durationMinutes} minutos).</p>${why}<p>O horário voltou a ficar disponível no seu perfil.</p>` });
}
