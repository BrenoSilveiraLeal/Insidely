import nodemailer from "nodemailer";
import { parseDbDate } from "./format";

type BookingRecipient = { email: string; name: string };

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character); }

// SMTP (e.g. Gmail with an app password) takes precedence; Resend needs a verified domain.
export const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const emailConfigured = () => process.env.E2E_MOCK_EXTERNALS === "true" || smtpConfigured() || Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

export async function sendTransactionalEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (process.env.E2E_MOCK_EXTERNALS === "true") return true;
  if (smtpConfigured()) {
    const port = Number(process.env.SMTP_PORT?.trim() || 465);
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST?.trim(), port, secure: port === 465, auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS?.replace(/\s/g, "")} });
    await transport.sendMail({ from: process.env.SMTP_FROM || `Insidely <${process.env.SMTP_USER}>`, to, subject, html });
    return true;
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }), cache: "no-store" });
  if (!response.ok) throw new Error(`Resend failed: ${response.status}`);
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBookingConfirmationEmails(supabase: any, bookingId: string, meetingUrl: string | null) {
  if (!emailConfigured()) return;
  const { data: booking, error } = await supabase.from("Booking").select("startsAt, durationMinutes, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (error || !booking) throw new Error(`booking_email_lookup: ${error?.message ?? "not_found"}`);
  const { data: customer } = await supabase.from("User").select("email, name").eq("id", booking.customerId).maybeSingle();
  const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
  const { data: consultant } = profile ? await supabase.from("User").select("email, name").eq("id", profile.userId).maybeSingle() : { data: null };
  const { data: publicProfile } = await supabase.from("public_profile_cards").select("user").eq("id", booking.professionalProfileId).maybeSingle();
  const safeConsultantName = Array.isArray(publicProfile?.user) ? publicProfile.user[0]?.name : (publicProfile?.user as { name?: string } | null)?.name;
  const recipients = [customer, consultant ? { ...consultant, name: safeConsultantName || "Pessoa da comunidade" } : null].filter((recipient): recipient is BookingRecipient => Boolean(recipient?.email)).filter((recipient, index, list) => list.findIndex((item) => item.email === recipient.email) === index);
  const date = parseDbDate(booking.startsAt).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const link = meetingUrl ? `<p><a href="${escapeHtml(meetingUrl)}">Entrar na videochamada</a></p>` : "<p>A sala estará disponível no painel no horário combinado.</p>";
  for (const recipient of recipients) await sendTransactionalEmail({ to: recipient.email, subject: "Sua conversa na Insidely foi confirmada", html: `<p>Olá, ${escapeHtml(recipient.name || "!")}</p><p>Sua conversa foi confirmada para <strong>${escapeHtml(date)}</strong>, com duração de ${booking.durationMinutes} minutos.</p>${link}<p>Acesse seu painel para acompanhar os detalhes.</p>` });
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
  await sendTransactionalEmail({ to, subject: copy.subject, html: `<p>Olá, ${escapeHtml(name || "!")}</p><p>${copy.intro}</p><p><a href="${escapeHtml(link)}">${copy.action}</a></p><p>Se você não fez esse pedido, ignore este e-mail.</p>` });
}
