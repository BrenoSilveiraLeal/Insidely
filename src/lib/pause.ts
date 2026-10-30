import "server-only";

// Ends pauses whose date of return has passed (run by the 5-minute job). A suspended account stays
// out of search even when its pause ends.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reactivateExpiredPauses(supabase: any, now = new Date()) {
  const { data: profiles } = await supabase.from("ProfessionalProfile").select("id, userId").not("pausedAt", "is", null).lte("pausedUntil", now.toISOString()).limit(100);
  let resumed = 0;
  for (const profile of (profiles ?? []) as { id: string; userId: string }[]) {
    const { data: suspended } = await supabase.rpc("is_user_suspended", { p_user_id: profile.userId });
    await supabase.from("ProfessionalProfile").update({ pausedAt: null, pausedUntil: null, ...(suspended ? {} : { isActive: true }), updatedAt: now.toISOString() }).eq("id", profile.id);
    await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: profile.userId, title: "Sua pausa terminou", body: "Seu perfil voltou para a busca. Confira se há horários abertos na sua agenda.", href: "/consultor/agenda", createdAt: now.toISOString() });
    resumed++;
  }
  return resumed;
}
