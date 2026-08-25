"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { blockedContactPattern } from "@/lib/security";
import { getAppUrl } from "@/lib/app-url";
import { createBookingCheckout, createConnectOnboardingLink, releaseBookingTransfer } from "@/lib/stripe-payments";

type FormState = { status: "success" | "error"; message: string } | undefined;
type RpcName = keyof Database["public"]["Functions"];
const rpc = async <Name extends RpcName>(name: Name, args: Database["public"]["Functions"][Name]["Args"]) => {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(name, args);
  if (result.error) throw new Error(`Supabase operation failed: ${result.error.message}`);
  return result.data;
};
const formText = (formData: FormData) => Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === "string" ? value : value.name]));
const adminAction = async (action: string, resourceId: string) => {
  const supabase = await createSupabaseServerClient();
  const { error } = action === "resolve_report"
    ? await supabase.rpc("admin_resolve_report", { p_report_id: resourceId, p_decision: "RESOLVED" })
    : await supabase.rpc("admin_review_verification", { p_verification_id: resourceId, p_decision: action === "verify_verification" ? "VERIFIED" : "REJECTED" });
  if (error) throw new Error(`Ação administrativa não pôde ser concluída: ${error.message}`);
};
async function moderateProfileImage(file: File) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { allowed: true, message: "" };
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetch("https://api.openai.com/v1/moderations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url: `data:${file.type};base64,${bytes}` } }] }) });
  if (!response.ok) return { allowed: false, message: response.status === 429 ? "O serviço de moderação está sem disponibilidade no momento. Tente novamente em alguns instantes." : "Não foi possível verificar a imagem agora." };
  const result = await response.json() as { results?: Array<{ flagged?: boolean }> };
  return result.results?.[0]?.flagged ? { allowed: false, message: "Esta imagem não pode ser usada como foto de perfil." } : { allowed: true, message: "" };
}

async function hasValidFileSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index]);
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

function avatarStoragePath(publicUrl: string | null | undefined, authUserId: string) {
  if (!publicUrl) return null;
  try {
    const marker = "/storage/v1/object/public/avatars/", pathname = new URL(publicUrl).pathname, index = pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(pathname.slice(index + marker.length));
    return path.startsWith(`avatars/${authUserId}/`) ? path : null;
  } catch { return null; }
}

function coverStoragePath(publicUrl: string | null | undefined, authUserId: string) {
  if (!publicUrl) return null;
  try {
    const marker = "/storage/v1/object/public/profile-covers/", pathname = new URL(publicUrl).pathname, index = pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(pathname.slice(index + marker.length));
    return path.startsWith(`covers/${authUserId}/`) ? path : null;
  } catch { return null; }
}

export async function loginAction(_: string | undefined, formData: FormData) {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return "E-mail ou senha inválidos.";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email.toLowerCase(), password: parsed.data.password });
  if (error?.code === "email_not_confirmed") return "Confirme seu e-mail antes de entrar.";
  if (error) return "E-mail ou senha incorretos.";
  redirect("/continuar");
}

export async function requestPasswordResetAction(_: string | undefined, formData: FormData) { const parsed = z.object({ email: z.string().email() }).safeParse(Object.fromEntries(formData)); if (!parsed.success) return "Digite um e-mail válido."; const supabase = await createSupabaseServerClient(); const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase(), { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/redefinir-senha` }); if (error) return "Não foi possível enviar o e-mail de recuperação."; return "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha."; }
export async function updatePasswordAction(_: string | undefined, formData: FormData) { const password = String(formData.get("password") || ""); const confirmation = String(formData.get("confirmation") || ""); if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return "A senha deve ter pelo menos 8 caracteres, uma letra maiúscula e um número."; if (password !== confirmation) return "As senhas não coincidem."; const supabase = await createSupabaseServerClient(); const { error } = await supabase.auth.updateUser({ password }); if (error) return "O link expirou ou não é mais válido. Solicite outra recuperação."; redirect("/entrar?senha=alterada"); }


export async function socialSignInAction(provider: "google" | "linkedin_oidc") {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${getAppUrl()}/auth/callback?next=/continuar` } });
  if (error || !data.url) redirect("/entrar?social=erro");
  redirect(data.url);
}

export async function registerAction(_: string | undefined, formData: FormData) {
  const parsed = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8).regex(/[A-Z]/).regex(/\d/), confirmPassword: z.string(), role: z.enum(["USER", "CONSULTANT"]), terms: z.literal("on") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return "A senha deve ter pelo menos 8 caracteres, uma letra maiúscula e um número.";
  if (parsed.data.password !== parsed.data.confirmPassword) return "As senhas não coincidem.";
  let signUpError: string | null = null;
  let hasSession = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ email: parsed.data.email.toLowerCase(), password: parsed.data.password, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/onboarding`, data: { name: parsed.data.name, role: parsed.data.role } } });
    signUpError = error?.message ?? null;
    hasSession = Boolean(data.session);
  } catch {
    return "Não foi possível criar sua conta agora. Verifique a conexão com o Supabase e tente novamente.";
  }
  if (signUpError) return signUpError;
  if (!hasSession) redirect("/entrar?cadastro=confirmar");
  redirect("/onboarding");
}

export async function logoutAction() { const supabase = await createSupabaseServerClient(); await supabase.auth.signOut(); redirect("/"); }

export async function completeOnboardingAction(_: string | undefined, formData: FormData) {
  await requireUser(undefined, { allowIncomplete: true });
  const role = formData.get("role") === "CONSULTANT" ? Role.CONSULTANT : Role.USER;
  if (formData.get("terms") !== "on") return "Aceite os termos da plataforma.";
  await rpc("complete_onboarding", { p_role: role, p_payload: formText(formData) });
  redirect(role === Role.CONSULTANT ? "/consultor" : "/dashboard");
}

export async function toggleFavoriteAction(profileId: string) { await requireUser(); await rpc("toggle_favorite", { p_profile_id: profileId }); revalidatePath("/dashboard/favoritos"); revalidatePath(`/profissional/${profileId}`); }
export async function createBookingAction(profileId: string, formData: FormData) {
  await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const slot = String(formData.get("slot") || "");
  const duration = Number(formData.get("duration")) === 60 ? 60 : 30;
  const goals = String(formData.get("goals") || "").trim();
  if (!slot || goals.length < 12) redirect(`/agendar/${profileId}?erro=preencha`);
  let booking: string;
  try {
    booking = await rpc("create_booking", { p_profile_id: profileId, p_slot_id: slot, p_duration: duration, p_topics: formData.getAll("topics").map(String), p_goals: goals });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const reason = message.includes("slot_unavailable") ? "indisponivel" : message.includes("unauthorized") ? "sessao" : "temporario";
    redirect(`/agendar/${profileId}?erro=${reason}`);
  }
  redirect(`/checkout/${booking}`);
}

export async function createStripeCheckoutAction(id: string) {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  try {
    const url = await createBookingCheckout({ bookingId: id, customerId: user.id, customerEmail: user.email, customerName: user.name, appUrl: getAppUrl() });
    if (!url) throw new Error("O Stripe não retornou uma URL de checkout.");
    redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.";
    redirect(`/checkout/${id}?erro=${encodeURIComponent(message)}`);
  }
}

export async function startStripeConnectOnboardingAction() {
  const user = await requireUser([Role.CONSULTANT]);
  const appUrl = getAppUrl();
  try {
    const url = await createConnectOnboardingLink({ userId: user.id, email: user.email, returnUrl: `${appUrl}/api/stripe/connect/return`, refreshUrl: `${appUrl}/consultor/perfil?stripe=refresh` });
    redirect(url);
  } catch (error) {
    redirect(`/consultor/perfil?stripe=erro&mensagem=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível iniciar o cadastro.")}`);
  }
}

function localDateToUtc(value: string, offset: number) { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + offset * 60_000); }
export async function createAvailabilityAction(_: FormState, formData: FormData): Promise<FormState> { const user = await requireUser([Role.CONSULTANT]); const starts = localDateToUtc(String(formData.get("startsAt")), Number(formData.get("timezoneOffset"))); const duration = Number(formData.get("duration")); if (!starts || !duration) return { status: "error", message: "Horário inválido." }; try { await rpc("create_consultant_availability", { p_user_id: user.id, p_starts_at: starts.toISOString(), p_ends_at: new Date(starts.getTime() + duration * 60_000).toISOString() }); revalidatePath("/consultor/agenda"); return { status: "success", message: "Horário adicionado à sua agenda." }; } catch { return { status: "error", message: "Não foi possível salvar este horário no Supabase." }; } }
export async function removeAvailabilityAction(id: string) { await requireUser([Role.CONSULTANT]); await rpc("remove_consultant_availability", { p_availability_id: id }); revalidatePath("/consultor/agenda"); }
export async function releaseEligibleBookings() { await rpc("release_eligible_bookings_for_user", {}); }
export async function completeBookingAction(id: string) { await requireUser([Role.CONSULTANT]); await rpc("complete_booking", { p_booking_id: id }); revalidatePath("/consultor/consultas"); }
export async function confirmConversationAction(id: string) { await requireUser(); await rpc("confirm_booking", { p_booking_id: id }); try { await releaseBookingTransfer(id); } catch { /* O webhook/cron pode concluir o repasse depois. */ } revalidatePath("/dashboard/agendamentos"); revalidatePath("/consultor/consultas"); revalidatePath("/consultor/ganhos"); }
export async function disputeBookingAction(id: string, formData: FormData) { await requireUser(); await rpc("dispute_booking", { p_booking_id: id, p_description: String(formData.get("description") || "") }); revalidatePath("/dashboard/agendamentos"); }
export async function submitReviewAction(_: FormState, formData: FormData): Promise<FormState> { await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]); const rating = Number(formData.get("rating")); const comment = String(formData.get("comment") || ""); if (rating < 1 || rating > 5 || comment.length < 12) return { status: "error", message: "Revise sua avaliação." }; await rpc("create_review", { p_booking_id: String(formData.get("bookingId")), p_rating: rating, p_comment: comment }); return { status: "success", message: "Avaliação publicada." }; }
export async function updateConsultantRecordingConsentAction(id: string, formData: FormData) { await requireUser([Role.CONSULTANT]); await rpc("set_recording_consent", { p_booking_id: id, p_consented: formData.get("recordingConsent") === "on" }); revalidatePath("/consultor/consultas"); }
export async function sendMessageAction(id: string, formData: FormData) { await requireUser(); const body = String(formData.get("body") || "").trim(); if (!body || body.length > 2000 || blockedContactPattern.test(body)) throw new Error("A mensagem está vazia, longa demais ou contém contato/link não permitido."); await rpc("send_message", { p_conversation_id: id, p_body: body }); revalidatePath("/dashboard/mensagens"); revalidatePath("/consultor/consultas"); }
export async function updatePrivacyAction(formData: FormData) { await requireUser([Role.CONSULTANT]); await rpc("update_privacy", { p_payload: formText(formData) }); revalidatePath("/consultor/privacidade"); redirect("/consultor/privacidade?salvo=1"); }
export async function updateProfessionalProfileAction(_: string | undefined, formData: FormData) { await requireUser([Role.CONSULTANT]); await rpc("update_professional_profile", { p_payload: formText(formData) }); revalidatePath("/consultor"); return "Perfil profissional atualizado."; }
export async function submitVerificationAction(_: string | undefined, formData: FormData) { await requireUser([Role.CONSULTANT]); const file = formData.get("document"); if (!(file instanceof File) || file.size === 0) return "Anexe um comprovante."; const allowed = ["application/pdf","image/jpeg","image/png","image/webp"]; if (!allowed.includes(file.type) || file.size > 5*1024*1024 || !await hasValidFileSignature(file)) return "Envie um PDF, JPG, PNG ou WEBP válido de até 5 MB."; const supabase = await createSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return "Sua sessão expirou."; const extension=file.type==="application/pdf"?"pdf":file.type==="image/jpeg"?"jpg":file.type.split("/")[1]; const path = `${user.id}/${crypto.randomUUID()}.${extension}`; const upload = await supabase.storage.from("verification-documents").upload(path, file, { upsert: false, contentType:file.type }); if (upload.error) return "Não foi possível enviar o documento."; await rpc("submit_verification", { p_storage_key: path, p_original_name: file.name.replace(/[^\p{L}\p{N}._ -]/gu,"_").slice(0,120), p_mime_type: file.type, p_size_bytes: file.size, p_method: String(formData.get("method") || "company_email") }); revalidatePath("/consultor/perfil"); return "Solicitação enviada com segurança."; }
export async function updateProfileImageAction(_: string | undefined, formData: FormData) { const stored = await requireUser(); const file = formData.get("image"); if (!(file instanceof File)) return "Escolha uma foto."; if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !await hasValidFileSignature(file)) return "Use uma imagem PNG, JPG ou WEBP válida."; if (file.size > 3 * 1024 * 1024) return "A foto deve ter no máximo 3 MB."; const moderation = await moderateProfileImage(file); if (!moderation.allowed) return moderation.message; const supabase = await createSupabaseServerClient(); const { data: authData, error: authError } = await supabase.auth.getUser(); if (authError || !authData.user) return "Sua sessão expirou. Entre novamente."; const path = `avatars/${authData.user.id}/${crypto.randomUUID()}-${file.name}`; const bucket = supabase.storage.from("avatars"); const upload = await bucket.upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" }); if (upload.error) return `Não foi possível enviar a foto: ${upload.error.message}`; const oldPath = avatarStoragePath(stored.image, authData.user.id); const { data } = bucket.getPublicUrl(path); const { error } = await supabase.rpc("update_profile_image", { p_image: data.publicUrl }); if (error) { await bucket.remove([path]); return `A foto foi enviada, mas não pôde ser salva no perfil: ${error.message}`; } if (oldPath && oldPath !== path) await bucket.remove([oldPath]); revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); return "Foto atualizada."; }
export async function removeProfileImageAction() {
  const stored = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error("Sua sessão expirou.");
  const path = avatarStoragePath(stored.image, authUser.id);
  if (path) {
    const { error: storageError } = await supabase.storage.from("avatars").remove([path]);
    if (storageError) throw new Error("Não foi possível remover o arquivo da foto.");
  }
  const { error } = await supabase.rpc("update_profile_image", { p_image: null });
  if (error) throw new Error("Não foi possível remover a foto do perfil.");
  revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor/perfil"); revalidatePath("/consultor");
}
export async function updateProfileCoverAction(_: string | undefined, formData: FormData) {
  const stored = await requireUser([Role.CONSULTANT]);
  const file = formData.get("cover");
  if (!(file instanceof File)) return "Escolha uma imagem para a capa.";
  if (!["image/png","image/jpeg","image/webp"].includes(file.type) || !await hasValidFileSignature(file)) return "Use uma imagem PNG, JPG ou WEBP válida.";
  if (file.size > 5 * 1024 * 1024) return "A capa deve ter no máximo 5 MB.";
  const moderation = await moderateProfileImage(file);
  if (!moderation.allowed) return "Esta imagem não pode ser usada como capa.";
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return "Sua sessão expirou. Entre novamente.";
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", stored.id).maybeSingle();
  if (!profile) return "Perfil profissional não encontrado.";
  const { data: oldCover } = await supabase.from("ProfileCover").select("image").eq("professionalProfileId", profile.id).maybeSingle();
  const path = `covers/${authData.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;
  const bucket = supabase.storage.from("profile-covers");
  const upload = await bucket.upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
  if (upload.error) return `Não foi possível enviar a capa: ${upload.error.message}`;
  const { data } = bucket.getPublicUrl(path);
  const { error } = await supabase.rpc("update_profile_cover", { p_image: data.publicUrl });
  if (error) { await bucket.remove([path]); return "A imagem foi enviada, mas não pôde ser salva no perfil."; }
  const oldPath = coverStoragePath(oldCover?.image, authData.user.id);
  if (oldPath && oldPath !== path) await bucket.remove([oldPath]);
  revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); revalidatePath("/profissional/[id]", "page");
  return "Capa atualizada.";
}
export async function removeProfileCoverAction() {
  const stored = await requireUser([Role.CONSULTANT]);
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Sua sessão expirou.");
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", stored.id).maybeSingle();
  const { data: oldCover } = profile ? await supabase.from("ProfileCover").select("image").eq("professionalProfileId", profile.id).maybeSingle() : { data: null };
  const oldPath = coverStoragePath(oldCover?.image, authData.user.id);
  if (oldPath) await supabase.storage.from("profile-covers").remove([oldPath]);
  const { error } = await supabase.rpc("remove_profile_cover");
  if (error) throw new Error("Não foi possível remover a capa.");
  revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); revalidatePath("/profissional/[id]", "page");
}
export async function deleteAccountAction(_: string | undefined, formData: FormData) { const user = await requireUser(); const confirmation = String(formData.get("confirmation") || "").trim().toLowerCase(); if (confirmation !== user.email.trim().toLowerCase()) return "Digite exatamente o e-mail da sua conta para confirmar a exclusão."; const supabase = await createSupabaseServerClient(); const { error } = await supabase.functions.invoke("delete-account", { body: { confirmation } }); if (error) return `Não foi possível concluir a remoção segura da conta: ${error.message}`; await supabase.auth.signOut(); redirect("/?conta=excluida"); }
export async function submitSupportAction(formData: FormData) { await requireUser(); await rpc("create_support_report", { p_category: String(formData.get("category") || ""), p_description: String(formData.get("description") || "") }); redirect("/suporte?enviado=1"); }
export async function markNotificationReadAction(id: string) { const user = await requireUser(); const supabase = await createSupabaseServerClient(); await supabase.from("Notification").update({ readAt: new Date().toISOString() }).eq("id", id).eq("userId", user.id).is("readAt", null); revalidatePath("/dashboard"); revalidatePath("/consultor"); }
export async function markAllNotificationsReadAction() { const user = await requireUser(); const supabase = await createSupabaseServerClient(); await supabase.from("Notification").update({ readAt: new Date().toISOString() }).eq("userId", user.id).is("readAt", null); revalidatePath("/dashboard"); revalidatePath("/consultor"); }
export async function reportProfileAction(profileId: string, formData: FormData) { await requireUser(); const category = String(formData.get("category") || ""); const description = String(formData.get("description") || "").trim(); if (description.length < 20 || description.length > 2000) redirect(`/profissional/${profileId}?denuncia=erro`); await rpc("create_profile_report", { p_profile_id: profileId, p_category: category, p_description: description }); redirect(`/profissional/${profileId}?denuncia=enviada`); }
export async function reviewVerificationAction(id: string, decision: "VERIFIED" | "REJECTED") { await requireUser([Role.ADMIN]); await adminAction(decision === "VERIFIED" ? "verify_verification" : "reject_verification", id); revalidatePath("/admin/verificacoes"); revalidatePath("/admin"); revalidatePath("/consultor/perfil"); }
export async function resolveReportAction(id: string) { await requireUser([Role.ADMIN]); await adminAction("resolve_report", id); revalidatePath("/admin/denuncias"); revalidatePath("/admin/suporte"); revalidatePath("/admin"); }
