import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("authorization");
  const url = Deno.env.get("SUPABASE_URL"), publishable = Deno.env.get("SUPABASE_ANON_KEY"), serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !publishable || !serviceRole) return json({ error: "service_unavailable" }, 503);

  const caller = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user?.email) return json({ error: "unauthorized" }, 401);
  let body: { confirmation?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  if (typeof body.confirmation !== "string" || body.confirmation.trim().toLowerCase() !== user.email.toLowerCase()) return json({ error: "confirmation_mismatch" }, 400);

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const { data: stored, error: profileError } = await admin.from("User").select("id,image,professionalProfile:ProfessionalProfile(id)").eq("auth_user_id", user.id).maybeSingle();
  if (profileError) return json({ error: "cleanup_check_failed" }, 500);

  if (stored) {
    const professionalId = Array.isArray(stored.professionalProfile) ? stored.professionalProfile[0]?.id : stored.professionalProfile?.id;
    let bookings = admin.from("Booking").select("id", { count: "exact", head: true }).in("status", ["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "AWAITING_CONFIRMATION", "DISPUTED"]);
    bookings = professionalId ? bookings.or(`customerId.eq.${stored.id},professionalProfileId.eq.${professionalId}`) : bookings.eq("customerId", stored.id);
    const { count, error: obligationError } = await bookings;
    if (obligationError) return json({ error: "obligation_check_failed" }, 500);
    if (count) return json({ error: "active_obligations" }, 409);
  }

  const removePrefix = async (bucketName: string, prefix: string) => {
    const bucket = admin.storage.from(bucketName);
    const { data, error } = await bucket.list(prefix, { limit: 1000 });
    if (error) throw error;
    const paths = (data ?? []).filter(item => item.id).map(item => `${prefix}/${item.name}`);
    if (paths.length) { const { error: removeError } = await bucket.remove(paths); if (removeError) throw removeError; }
  };

  try {
    await removePrefix("avatars", `avatars/${user.id}`);
    await removePrefix("verification-documents", user.id);
  } catch { return json({ error: "storage_cleanup_failed" }, 500); }

  if (stored) {
    const { error: auditError } = await admin.from("AccountDeletionAudit").insert({ auth_user_id: user.id });
    if (auditError && auditError.code !== "23505") return json({ error: "audit_failed" }, 500);
    const { error: cleanupError } = await admin.from("User").update({ name: "Conta excluída", email: `deleted+${user.id}@invalid.insidely`, image: null, auth_user_id: null, onboardingCompleted: false, updatedAt: new Date().toISOString() }).eq("id", stored.id);
    if (cleanupError) return json({ error: "database_cleanup_failed" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: "auth_deletion_failed" }, 500);
  return json({ ok: true });
});
