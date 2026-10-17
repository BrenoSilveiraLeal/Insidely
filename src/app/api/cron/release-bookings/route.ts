import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseBookingTransfer } from "@/lib/stripe-payments";
import { parseDbDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    // The migration adds provider-specific columns beyond the generated legacy type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseServiceClient() as any;
    const { data: expired, error: expiryError } = await supabase.rpc("expire_past_unpaid_bookings");
    if (expiryError) return Response.json({ error: "expiration_failed", detail: expiryError.message }, { status: 500 });
    const { data: simulationReleased, error: simulationReleaseError } = await supabase.rpc("release_eligible_bookings_system");
    if (simulationReleaseError) return Response.json({ error: "simulation_release_failed", detail: simulationReleaseError.message }, { status: 500 });
    const { data: bookings, error } = await supabase.from("Booking").select("id, status, autoReleaseAt, startsAt, durationMinutes, payment:Payment(status, provider)").in("status", ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING"]).is("disputedAt", null);
    if (error) return Response.json({ error: "release_failed", detail: error.message }, { status: 500 });
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
    return Response.json({ ok: true, released, simulationReleased: Number(simulationReleased ?? 0), expired: Number(expired ?? 0) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "release_failed" }, { status: 500 });
  }
}
