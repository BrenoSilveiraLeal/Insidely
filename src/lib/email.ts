type BookingRecipient = { email: string; name: string };

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character); }

export async function sendTransactionalEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }), cache: "no-store" });
  if (!response.ok) throw new Error(`Resend failed: ${response.status}`);
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBookingConfirmationEmails(supabase: any, bookingId: string, meetingUrl: string | null) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  const { data: booking, error } = await supabase.from("Booking").select("startsAt, durationMinutes, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (error || !booking) throw new Error(`booking_email_lookup: ${error?.message ?? "not_found"}`);
  const { data: customer } = await supabase.from("User").select("email, name").eq("id", booking.customerId).maybeSingle();
  const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
  const { data: consultant } = profile ? await supabase.from("User").select("email, name").eq("id", profile.userId).maybeSingle() : { data: null };
  const recipients = [customer, consultant].filter((recipient): recipient is BookingRecipient => Boolean(recipient?.email)).filter((recipient, index, list) => list.findIndex((item) => item.email === recipient.email) === index);
  const date = new Date(booking.startsAt).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const link = meetingUrl ? `<p><a href="${escapeHtml(meetingUrl)}">Entrar na sala do Google Meet</a></p>` : "<p>O link da sala será disponibilizado no painel assim que a integração for concluída.</p>";
  for (const recipient of recipients) await sendTransactionalEmail({ to: recipient.email, subject: "Sua conversa na Insidely foi confirmada", html: `<p>Olá, ${escapeHtml(recipient.name || "!")}</p><p>Sua conversa foi confirmada para <strong>${escapeHtml(date)}</strong>, com duração de ${booking.durationMinutes} minutos.</p>${link}<p>Acesse seu painel para acompanhar os detalhes.</p>` });
}
