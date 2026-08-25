import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseBookingTransfer } from "@/lib/stripe-payments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    // The migration adds provider-specific columns beyond the generated legacy type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseServiceClient() as any;
    const { data: bookings, error } = await supabase.from("Booking").select("id, status, autoReleaseAt, startsAt, durationMinutes, payment:Payment(status)").in("status", ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING"]).is("disputedAt", null);
    if (error) return Response.json({ error: "release_failed", detail: error.message }, { status: 500 });
    let released = 0;
    for (const booking of bookings ?? []) {
      const payment = Array.isArray(booking.payment) ? booking.payment[0] : booking.payment;
      const releaseAt = booking.autoReleaseAt ?? new Date(new Date(booking.startsAt).getTime() + (Number(booking.durationMinutes) + 1440) * 60_000).toISOString();
      if (new Date(releaseAt) <= new Date() && ["HELD", "PAID_HELD", "TRANSFER_FAILED"].includes(payment?.status)) {
        if (await releaseBookingTransfer(booking.id)) released++;
      }
    }
    return Response.json({ ok: true, released });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "release_failed" }, { status: 500 });
  }
}
