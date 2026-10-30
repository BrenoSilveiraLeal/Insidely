import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseBookingTransfer } from "@/lib/stripe-payments";
import { parseDbDate } from "@/lib/format";
import { applyRetention } from "@/lib/retention";
import { flagSuspiciousAccounts } from "@/lib/suspicious";
import { promptDecisionStories } from "@/lib/decision-stories";
import { remindEmptyAgendas } from "@/lib/empty-agenda";
import { recordCronRun } from "@/lib/admin-log";
import { alertAdmins } from "@/lib/ops-alerts";

import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    // The migration adds provider-specific columns beyond the generated legacy type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseServiceClient() as any;
    const { data: expired, error: expiryError } = await supabase.rpc("expire_past_unpaid_bookings");
    if (expiryError) { await recordCronRun(supabase, "daily", false, `expiration_failed: ${expiryError.message}`); return Response.json({ error: "expiration_failed", detail: expiryError.message }, { status: 500 }); }
    const { data: simulationReleased, error: simulationReleaseError } = await supabase.rpc("release_eligible_bookings_system");
    if (simulationReleaseError) { await recordCronRun(supabase, "daily", false, `simulation_release_failed: ${simulationReleaseError.message}`); return Response.json({ error: "simulation_release_failed", detail: simulationReleaseError.message }, { status: 500 }); }
    const { data: bookings, error } = await supabase.from("Booking").select("id, status, autoReleaseAt, startsAt, durationMinutes, payment:Payment(status, provider)").in("status", ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING"]).is("disputedAt", null);
    if (error) { await recordCronRun(supabase, "daily", false, `release_failed: ${error.message}`); return Response.json({ error: "release_failed", detail: error.message }, { status: 500 }); }
    let released = 0;
    for (const booking of bookings ?? []) {
      try {
      const payment = Array.isArray(booking.payment) ? booking.payment[0] : booking.payment;
      if (payment?.provider === "SIMULATION") continue;
      const releaseAt = booking.autoReleaseAt ?? new Date(parseDbDate(booking.startsAt).getTime() + (Number(booking.durationMinutes) + 1440) * 60_000).toISOString();
      if (new Date(releaseAt) <= new Date() && ["HELD", "PAID_HELD", "TRANSFER_FAILED"].includes(payment?.status)) {
        if (await releaseBookingTransfer(booking.id)) released++;
      }
      } catch (bookingError) { console.error("booking_release_failed", { bookingId: booking.id, error: bookingError }); }
    }
    const suspicious = await flagSuspiciousAccounts(supabase).catch((flagError) => { console.error("suspicious_scan_failed", { error: flagError }); return null; });
    const decisionPrompts = await promptDecisionStories(supabase).catch((promptError) => { console.error("decision_prompt_failed", { error: promptError }); return null; });
    const emptyAgendas = await remindEmptyAgendas(supabase).catch((agendaError) => { console.error("empty_agenda_failed", { error: agendaError }); return null; });
    const retention = await applyRetention(supabase).catch((retentionError) => { console.error("retention_failed", { error: retentionError }); return null; });
    const result = { ok: true, released, simulationReleased: Number(simulationReleased ?? 0), expired: Number(expired ?? 0), retention, suspicious, decisionPrompts, emptyAgendas };
    await recordCronRun(supabase, "daily", true, result);
    return Response.json(result);
  } catch (error) {
    await recordCronRun(createSupabaseServiceClient(), "daily", false, error instanceof Error ? error.message : "release_failed");
    await alertAdmins("cron:daily", "A tarefa diária falhou", `A tarefa diária (expiração de pedidos, repasses, retenção de dados e avisos) falhou: ${error instanceof Error ? error.message : "erro desconhecido"}.`);
    return Response.json({ error: error instanceof Error ? error.message : "release_failed" }, { status: 500 });
  }
}
