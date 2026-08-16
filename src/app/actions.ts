"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type FormState = { status: "success" | "error"; message: string } | undefined;
const rpc = async (name: string, args: Record<string, unknown> = {}) => {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(name, args);
  if (result.error) throw new Error(`Supabase operation failed: ${result.error.message}`);
  return result.data;
};
const adminAction = async (action: string, resourceId: string) => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.functions.invoke("admin-actions", { body: { action, resourceId } });
  if (error) throw new Error("A a administrativa n p ser conclu.");
};

export async function loginAction(_: string | undefined, formData: FormData) {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return "E-mail ou senha invs.";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email.toLowerCase(), password: parsed.data.password });
  if (error) return "E-mail ou senha incorretos.";
  redirect("/continuar");
}


export async function socialSignInAction(provider: "google" | "linkedin_oidc") {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/continuar` } });
  if (error || !data.url) redirect("/entrar?social=erro");
  redirect(data.url);
}

export async function registerAction(_: string | undefined, formData: FormData) {
  const parsed = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8).regex(/[A-Z]/).regex(/\d/), confirmPassword: z.string(), role: z.enum(["USER", "CONSULTANT"]), terms: z.literal("on") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return "A senha deve ter pelo menos 8 caracteres, uma letra maiúscula e um número.";
  if (parsed.data.password !== parsed.data.confirmPassword) return "As senhas não coincidem.";
  let signUpError: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({ email: parsed.data.email.toLowerCase(), password: parsed.data.password, options: { data: { name: parsed.data.name, role: parsed.data.role } } });
    signUpError = error?.message ?? null;
  } catch {
    return "Não foi possível criar sua conta agora. Verifique a conexão com o Supabase e tente novamente.";
  }
  if (signUpError) return signUpError;
  redirect("/onboarding");
}

export async function logoutAction() { const supabase = await createSupabaseServerClient(); await supabase.auth.signOut(); redirect("/"); }

export async function completeOnboardingAction(_: string | undefined, formData: FormData) {
  await requireUser(undefined, { allowIncomplete: true });
  const role = formData.get("role") === "CONSULTANT" ? Role.CONSULTANT : Role.USER;
  if (formData.get("terms") !== "on") return "Aceite os termos da plataforma.";
  await rpc("complete_onboarding", { p_role: role, p_payload: Object.fromEntries(formData) });
  redirect(role === Role.CONSULTANT ? "/consultor" : "/dashboard");
}

export async function toggleFavoriteAction(profileId: string) { await requireUser(); await rpc("toggle_favorite", { p_profile_id: profileId }); revalidatePath("/dashboard/favoritos"); revalidatePath(`/profissional/${profileId}`); }
export async function createBookingAction(profileId: string, formData: FormData) { await requireUser([Role.USER, Role.ADMIN]); const booking = await rpc("create_booking", { p_profile_id: profileId, p_slot_id: String(formData.get("slot")), p_duration: Number(formData.get("duration")) === 60 ? 60 : 30, p_topics: formData.getAll("topics"), p_goals: String(formData.get("goals") || "") }); redirect(`/checkout/${booking}`); }

function localDateToUtc(value: string, offset: number) { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + offset * 60_000); }
export async function createAvailabilityAction(_: FormState, formData: FormData): Promise<FormState> { const user = await requireUser([Role.CONSULTANT]); const starts = localDateToUtc(String(formData.get("startsAt")), Number(formData.get("timezoneOffset"))); const duration = Number(formData.get("duration")); if (!starts || !duration) return { status: "error", message: "Horário inválido." }; try { await rpc("create_consultant_availability", { p_user_id: user.id, p_starts_at: starts.toISOString(), p_ends_at: new Date(starts.getTime() + duration * 60_000).toISOString() }); revalidatePath("/consultor/agenda"); return { status: "success", message: "Horário adicionado à sua agenda." }; } catch { return { status: "error", message: "Não foi possível salvar este horário no Supabase." }; } }
export async function removeAvailabilityAction(id: string) { await requireUser([Role.CONSULTANT]); await rpc("remove_consultant_availability", { p_availability_id: id }); revalidatePath("/consultor/agenda"); }
export async function releaseEligibleBookings() { await rpc("release_eligible_bookings_for_user"); }
export async function completeBookingAction(id: string) { await requireUser([Role.CONSULTANT]); await rpc("complete_booking", { p_booking_id: id }); revalidatePath("/consultor/consultas"); }
export async function confirmConversationAction(id: string) { await requireUser(); await rpc("confirm_booking", { p_booking_id: id }); revalidatePath("/dashboard/agendamentos"); revalidatePath("/consultor/consultas"); }
export async function disputeBookingAction(id: string, formData: FormData) { await requireUser(); await rpc("dispute_booking", { p_booking_id: id, p_description: String(formData.get("description") || "") }); revalidatePath("/dashboard/agendamentos"); }
export async function submitReviewAction(_: FormState, formData: FormData): Promise<FormState> { await requireUser([Role.USER, Role.ADMIN]); const rating = Number(formData.get("rating")); const comment = String(formData.get("comment") || ""); if (rating < 1 || rating > 5 || comment.length < 12) return { status: "error", message: "Revise sua avalia." }; await rpc("create_review", { p_booking_id: String(formData.get("bookingId")), p_rating: rating, p_comment: comment }); return { status: "success", message: "Avalia publicada." }; }
export async function payBookingAction(id: string, formData: FormData) { await requireUser([Role.USER, Role.ADMIN]); if (formData.get("recordingConsent") !== "on") throw new Error("Confirme as regras antes de continuar."); await rpc("report_booking_payment", { p_booking_id: id, p_method: String(formData.get("paymentMethod") || "PIX") }); redirect("/dashboard/agendamentos?pagamento_informado=1"); }
export async function adminConfirmPaymentAction(id: string, formData: FormData) { await requireUser([Role.ADMIN]); await rpc("admin_confirm_booking_payment", { p_booking_id: id, p_observation: String(formData.get("observation") || "") }); revalidatePath("/admin"); revalidatePath(`/checkout/${id}`); }
export async function updateConsultantRecordingConsentAction(id: string, formData: FormData) { await requireUser([Role.CONSULTANT]); await rpc("set_recording_consent", { p_booking_id: id, p_consented: formData.get("recordingConsent") === "on" }); revalidatePath("/consultor/consultas"); }
export async function sendMessageAction(id: string, formData: FormData) { await requireUser(); const body = String(formData.get("body") || "").trim(); if (body) await rpc("send_message", { p_conversation_id: id, p_body: body }); revalidatePath("/dashboard/mensagens"); }
export async function updatePrivacyAction(formData: FormData) { await requireUser([Role.CONSULTANT]); await rpc("update_privacy", { p_payload: Object.fromEntries(formData) }); revalidatePath("/consultor/privacidade"); }
export async function updateProfessionalProfileAction(_: string | undefined, formData: FormData) { await requireUser([Role.CONSULTANT]); await rpc("update_professional_profile", { p_payload: Object.fromEntries(formData) }); revalidatePath("/consultor"); return "Perfil profissional atualizado."; }
export async function submitVerificationAction(_: string | undefined, formData: FormData) { await requireUser([Role.CONSULTANT]); const file = formData.get("document"); if (!(file instanceof File)) return "Anexe um comprovante."; const supabase = await createSupabaseServerClient(); const path = `verificacoes/${crypto.randomUUID()}-${file.name}`; const upload = await supabase.storage.from("verification-documents").upload(path, file, { upsert: false }); if (upload.error) return "N foi poss enviar o documento."; await rpc("submit_verification", { p_storage_key: path, p_original_name: file.name, p_mime_type: file.type, p_size_bytes: file.size, p_method: String(formData.get("method") || "company_email") }); revalidatePath("/consultor/perfil"); return "Solicita enviada com seguran."; }
export async function updateProfileImageAction(_: string | undefined, formData: FormData) { const user = await requireUser(); const file = formData.get("image"); if (!(file instanceof File)) return "Escolha uma foto."; if (file.size > 3 * 1024 * 1024) return "A foto deve ter no máximo 3 MB."; const supabase = await createSupabaseServerClient(); const path = `avatars/${user.id}/${crypto.randomUUID()}-${file.name}`; const upload = await supabase.storage.from("avatars").upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" }); if (upload.error) return `Não foi possível enviar a foto: ${upload.error.message}`; const { data } = supabase.storage.from("avatars").getPublicUrl(path); const { error } = await supabase.from("User").update({ image: data.publicUrl }).eq("auth_user_id", user.id); if (error) return `A foto foi enviada, mas não pôde ser salva no perfil: ${error.message}`; revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); return "Foto atualizada."; }
export async function removeProfileImageAction() { const user = await requireUser([Role.CONSULTANT]); const supabase = await createSupabaseServerClient(); const { error } = await supabase.from("User").update({ image: null }).eq("auth_user_id", user.id); if (error) throw new Error(`Não foi possível remover a foto: ${error.message}`); revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); }
export async function deleteAccountAction(_: string | undefined, formData: FormData) { const user = await requireUser(); const confirmation = String(formData.get("confirmation") || "").trim().toLowerCase(); if (confirmation !== user.email.trim().toLowerCase()) return "Digite exatamente o e-mail da sua conta para confirmar a exclusão."; const supabase = await createSupabaseServerClient(); const { error } = await supabase.functions.invoke("delete-account", { body: { confirmation } }); if (error) return `Não foi possível concluir a remoção segura da conta: ${error.message}`; await supabase.auth.signOut(); redirect("/?conta=excluida"); }
export async function submitSupportAction(formData: FormData) { await requireUser(); await rpc("create_support_report", { p_category: String(formData.get("category") || ""), p_description: String(formData.get("description") || "") }); redirect("/suporte?enviado=1"); }
export async function reviewVerificationAction(id: string, decision: "VERIFIED" | "REJECTED") { await requireUser([Role.ADMIN]); await adminAction(decision === "VERIFIED" ? "verify_verification" : "reject_verification", id); revalidatePath("/admin/verificacoes"); }
export async function resolveReportAction(id: string) { await requireUser([Role.ADMIN]); await adminAction("resolve_report", id); revalidatePath("/admin/denuncias"); }
