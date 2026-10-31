import "server-only";
import { consumeQuota } from "@/lib/auth-email-throttle";
import { sendTransactionalEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { money } from "@/lib/format";

// Daily: payments kept held because the consultant has no Pix key. Once the key exists the
// simulated ones are released here (real ones go through releaseBookingTransfer in the same job);
// otherwise the consultant gets an e-mail at most every 3 days with the amount waiting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processPixHolds(supabase: any) {
  const { data } = await supabase.from("Payment").select("id, provider, bookingId, booking:Booking!inner(status, totalCents, feeCents, professionalProfile:ProfessionalProfile(pixKey, userId, user:User(name, email)))")
    .in("status", ["HELD", "PAID_HELD"]).eq("booking.status", "COMPLETED");
  let released = 0, reminded = 0;
  const waiting = new Map<string, { name: string; email: string; cents: number }>();
  for (const row of (data ?? []) as { id: string; provider: string; booking: { totalCents: number; feeCents: number; professionalProfile: { pixKey: string | null; userId: string; user: { name: string; email: string } | null } | null } }[]) {
    const profile = row.booking.professionalProfile;
    if (!profile) continue;
    if (String(profile.pixKey ?? "").trim()) {
      if (row.provider === "SIMULATION") {
        const { error } = await supabase.from("Payment").update({ status: "RELEASED", releasedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", row.id);
        if (!error) released++;
      }
      continue;
    }
    const entry = waiting.get(profile.userId) ?? { name: profile.user?.name ?? "", email: profile.user?.email ?? "", cents: 0 };
    entry.cents += row.booking.totalCents - row.booking.feeCents;
    waiting.set(profile.userId, entry);
  }
  for (const [userId, entry] of waiting) {
    if (!entry.email || !await consumeQuota(`pix-hold:${userId}`, 1, 3 * 24 * 3600)) continue;
    await sendTransactionalEmail({ to: entry.email, subject: "Cadastre sua chave Pix para receber", html: `<p>Olá${entry.name ? `, ${entry.name.split(" ")[0]}` : ""}!</p><p>Você tem <strong>${money(entry.cents)}</strong> de conversas concluídas esperando para ser enviado, mas ainda não informou uma chave Pix.</p><p>Cadastre a chave em Editar perfil e o valor é liberado no próximo repasse.</p><p><a href="${getAppUrl()}/consultor/perfil">Cadastrar chave Pix</a></p>` }).then(() => reminded++, (error) => console.error("pix_hold_email_failed", { error }));
  }
  return { released, reminded, waiting: waiting.size };
}
