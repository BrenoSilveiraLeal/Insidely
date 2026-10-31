"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@/lib/domain";
import { getAuthenticatedUser, getSuspension, requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/database.types";
import { maskUnsafeGoal, safeInternalPath } from "@/lib/security";
import { findUnsafeProfileText, moderateChatMessage, unsafeProfileTextMessage } from "@/lib/chat-moderation";
import { CONVERSATION_REPORT_CATEGORIES } from "@/lib/reports";
import { VERIFICATION_METHODS } from "@/lib/verification";
import { recordAccess } from "@/lib/access-log";
import { logAdminAction } from "@/lib/admin-log";
import { postWelcomeMessage } from "@/lib/conversation-extras";
import { TERMS_VERSION } from "@/lib/terms";
import { conversationIdForParticipant, markConversationRead } from "@/lib/conversations";
import { canReviewBooking, canSendBookingMessage } from "@/lib/booking-policy";
import { ageOn, cpfDigits, isValidCpf } from "@/lib/identity";
import { catalogKey, catalogSlug, cleanCatalogName, UNLISTED_COMPANY_ID, UNLISTED_IDS, UNLISTED_PROFESSION_ID } from "@/lib/catalog";
import { getAppUrl } from "@/lib/app-url";
import { suggestEmail } from "@/lib/email-typo";
import { createEmailChangeToken } from "@/lib/email-change-token";
import { allowAuthEmail, allowIdentityAttempt, consumeQuota } from "@/lib/auth-email-throttle";
import { accountHasPassword } from "@/lib/auth-user";
import { parseDbDate, shortDate } from "@/lib/format";
import { cancelBookingAndRefund, createBookingCheckout, createConnectOnboardingLink, refundCustomerCancellation, releaseBookingTransfer } from "@/lib/stripe-payments";
import { emailButton, sendSecurityEmail, sendTransactionalEmail, sendAuthLinkEmail, sendEmailChangeConfirmation, sendBookingCancellationEmail, sendCustomerCancellationEmail, sendBookingConfirmationEmails, sendPaymentInstructionsEmail, appEmailConfigured } from "@/lib/email";
import { ensureGoogleMeetForBooking } from "@/lib/google-meet";
import { HOME_STORY_LIMIT } from "@/lib/story-limits";
import { formatPersonName } from "@/lib/person-name";
import { isRepetitive, tidyHeadline, tidyPresentation } from "@/lib/profile-text";
import { readEmploymentPeriod, saveEmploymentPeriod } from "@/lib/employment-period";
import { imageModerationMessage, moderateImage } from "@/lib/image-moderation";

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

export type LoginState = { message: string; field?: "email" | "password"; hint?: "register" | "help"; suggestion?: string } | undefined;

// Checks a password without touching the caller's session cookies; the throwaway session is revoked right away.
async function passwordMatches(email: string, password: string) {
  const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (!error) await verifier.auth.signOut({ scope: "local" });
  return !error;
}

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!z.string().email().safeParse(email).success) {
    const suggestion = suggestEmail(email);
    return { message: suggestion ? `Este e-mail parece incorreto. Você quis dizer ${suggestion}?` : "Este e-mail parece incorreto. Confira se digitou certo.", field: "email", suggestion: suggestion ?? undefined };
  }
  if (!password) return { message: "Digite sua senha.", field: "password" };
  const supabase = await createSupabaseServerClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") return { message: "Confirme seu e-mail antes de entrar. Não recebeu o link? Cadastre-se de novo com o mesmo e-mail para reenviá-lo.", field: "email", hint: "register" };
  if (error?.code === "invalid_credentials") {
    // Same answer whether the account exists or not, so the login never reveals who is registered.
    const suggestion = suggestEmail(email);
    return { message: suggestion ? `E-mail ou senha incorretos. Você quis dizer ${suggestion}?` : "E-mail ou senha incorretos.", hint: "help", suggestion: suggestion ?? undefined };
  }
  if (error?.status === 429 || error?.code === "over_request_rate_limit") return { message: "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente." };
  if (error) return { message: "Não foi possível entrar agora. Tente novamente." };
  if (signIn.user) await recordAccess(signIn.user.id, "password");
  // Always pass through /continuar so MFA and onboarding run before the requested page.
  const next = safeInternalPath(String(formData.get("next") || ""), "");
  redirect(next && next !== "/continuar" ? `/continuar?next=${encodeURIComponent(next)}` : "/continuar");
}

export async function requestPasswordResetAction(_: string | undefined, formData: FormData) { const parsed = z.object({ email: z.string().email() }).safeParse(Object.fromEntries(formData)); if (!parsed.success) return "Digite um e-mail válido."; const done = "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha."; if (appEmailConfigured()) { const email = parsed.data.email.toLowerCase(); if (!await allowAuthEmail("recovery", email)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente."; const { data, error } = await createSupabaseServiceClient().auth.admin.generateLink({ type: "recovery", email }); if (error || !data.properties?.hashed_token) return done; try { await sendAuthLinkEmail({ to: email, name: String(data.user?.user_metadata?.name ?? ""), kind: "recovery", link: `${getAppUrl()}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery` }); } catch (mailError) { console.error("recovery_email_failed", mailError); return "Não foi possível enviar o e-mail de recuperação."; } return done; } const supabase = await createSupabaseServerClient(); const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase(), { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/redefinir-senha` }); if (error) return "Não foi possível enviar o e-mail de recuperação."; return "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha."; }
export async function updatePasswordAction(_: string | undefined, formData: FormData) {
  const password = String(formData.get("password") || ""); const confirmation = String(formData.get("confirmation") || "");
  if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return "A senha deve ter pelo menos 8 caracteres, uma letra maiúscula e um número.";
  if (password !== confirmation) return "As senhas não coincidem.";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "O link expirou ou não é mais válido. Solicite outra recuperação.";
  const { error } = await supabase.auth.updateUser({ password });
  // Accounts with 2FA must confirm the code before changing the password.
  if (error?.code === "insufficient_aal") redirect("/mfa?next=/redefinir-senha");
  if (error) return error.code === "same_password" ? "A nova senha precisa ser diferente da anterior." : error.code === "weak_password" ? "Escolha uma senha mais forte." : "Não foi possível alterar a senha. Solicite outra recuperação.";
  if (!accountHasPassword(user)) await createSupabaseServiceClient().auth.admin.updateUserById(user.id, { app_metadata: { has_password: true } });
  // Whoever had the old password is signed out everywhere.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/entrar?senha=alterada");
}
export async function changePasswordAction(_: string | undefined, formData: FormData) {
  await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const password = String(formData.get("password") || ""); const confirmation = String(formData.get("confirmation") || "");
  if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return "A senha deve ter pelo menos 8 caracteres, uma letra maiúscula e um número.";
  if (password !== confirmation) return "As senhas não coincidem.";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return "Sua sessão expirou. Entre novamente.";
  const hasPassword = accountHasPassword(user);
  // Google-only accounts have no current password yet: they are creating one.
  if (hasPassword) {
    const currentPassword = String(formData.get("currentPassword") || "");
    if (!currentPassword) return "Informe sua senha atual.";
    if (!await passwordMatches(user.email, currentPassword)) return "Senha atual incorreta.";
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return error.code === "same_password" ? "A nova senha precisa ser diferente da atual." : error.code === "insufficient_aal" ? "Confirme o código do 2FA (saia e entre novamente) antes de trocar a senha." : error.code === "weak_password" ? "Escolha uma senha mais forte." : "Não foi possível alterar sua senha agora. Tente novamente.";
  if (!hasPassword) await createSupabaseServiceClient().auth.admin.updateUserById(user.id, { app_metadata: { has_password: true } });
  // Other devices that knew the old password are signed out; this one stays.
  await supabase.auth.signOut({ scope: "others" });
  return "Senha alterada com sucesso.";
}

const EXISTING_ACCOUNT = "Já existe uma conta com este e-mail. Entre com sua senha ou recupere o acesso.";
const EXISTING_GOOGLE_ACCOUNT = "Já existe uma conta com este e-mail, criada com o Google. Entre usando o botão do Google.";

export async function registerAction(_: string | undefined, formData: FormData) {
  const parsed = z.object({ name: z.string().trim().min(2), email: z.string().trim().email(), password: z.string().min(8).regex(/[A-Z]/).regex(/\d/), confirmPassword: z.string(), role: z.enum(["USER", "CONSULTANT"]), terms: z.literal("on") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    if (fields.has("name")) return "Digite seu nome (pelo menos 2 letras).";
    if (fields.has("email")) return "Digite um e-mail válido.";
    if (fields.has("password")) return "A senha deve ter pelo menos 8 caracteres, uma letra maiúscula e um número.";
    if (fields.has("terms")) return "Aceite os termos para criar sua conta.";
    return "Revise os dados do cadastro.";
  }
  if (parsed.data.password !== parsed.data.confirmPassword) return "As senhas não coincidem.";
  const email = parsed.data.email.toLowerCase();
  const metadata = { name: formatPersonName(parsed.data.name), role: parsed.data.role };
  // Send the confirmation link ourselves (Resend, or SMTP locally) instead of relying on Supabase's mailer.
  if (appEmailConfigured()) {
    if (!await allowAuthEmail("signup", email)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
    const service = createSupabaseServiceClient();
    const signup = await service.auth.admin.generateLink({ type: "signup", email, password: parsed.data.password, options: { data: metadata } });
    // Every outcome below ends on the same "check your e-mail" screen; the difference is only in the
    // message that reaches the inbox, so the form never reveals whether an address is registered.
    let send: () => Promise<void>;
    let createdUserId: string | null = null;
    if (!signup.error) {
      createdUserId = signup.data.user?.id ?? null;
      const link = `${getAppUrl()}/auth/confirm?token_hash=${encodeURIComponent(signup.data.properties.hashed_token)}&type=signup&next=/onboarding`;
      send = () => sendAuthLinkEmail({ to: email, name: parsed.data.name, kind: "signup", link });
    } else if (/already|registered|exists/i.test(`${signup.error.code} ${signup.error.message}`)) {
      // A previous attempt may have left the account unconfirmed (the e-mail never arrived).
      // Resend a confirmation link for that account; its password is left untouched.
      const existing = await service.auth.admin.generateLink({ type: "magiclink", email });
      if (existing.error || !existing.data.user) return "Não foi possível criar sua conta agora. Tente novamente.";
      // A confirmed account already uses this address: say so on the form (with links to sign in or
      // reset the password) instead of a generic screen. An unconfirmed one gets a fresh link below.
      if (existing.data.user.email_confirmed_at) {
        return accountHasPassword(existing.data.user) ? EXISTING_ACCOUNT : EXISTING_GOOGLE_ACCOUNT;
      } else {
        const link = `${getAppUrl()}/auth/confirm?token_hash=${encodeURIComponent(existing.data.properties.hashed_token)}&type=email&next=/onboarding`;
        send = () => sendAuthLinkEmail({ to: email, name: parsed.data.name, kind: "signup", link });
      }
    } else {
      console.error("signup_link_failed", { code: signup.error.code, message: signup.error.message });
      return /password/i.test(signup.error.message) ? "Escolha uma senha mais forte." : "Não foi possível criar sua conta agora. Tente novamente.";
    }
    try {
      await send();
    } catch (mailError) {
      console.error("signup_email_failed", mailError);
      // Without the e-mail nobody can confirm this account: remove it so the next attempt starts clean.
      if (createdUserId) await service.auth.admin.deleteUser(createdUserId);
      return "Não foi possível enviar o e-mail de confirmação agora. Tente novamente em alguns minutos.";
    }
    redirect("/entrar?cadastro=confirmar");
  }
  let signUpError: string | null = null;
  let hasSession = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ email, password: parsed.data.password, options: { emailRedirectTo: `${getAppUrl()}/auth/callback?next=/onboarding`, data: metadata } });
    signUpError = error?.message ?? null;
    hasSession = Boolean(data.session);
  } catch {
    return "Não foi possível criar sua conta agora. Verifique a conexão com o Supabase e tente novamente.";
  }
  if (signUpError) {
    const message = signUpError.toLowerCase();
    if (message.includes("already registered")) return EXISTING_ACCOUNT;
    if (message.includes("sending confirmation email")) {
      console.error("signup_supabase_mailer_failed", { message: signUpError });
      // Local development without any mailer: create the account already confirmed so it can be used.
      if (process.env.NODE_ENV !== "production" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const created = await createSupabaseServiceClient().auth.admin.createUser({ email, password: parsed.data.password, email_confirm: true, user_metadata: metadata });
        if (created.error) {
          if (/already/i.test(created.error.message)) redirect("/entrar?cadastro=confirmar");
          return "Não foi possível criar sua conta agora. Tente novamente.";
        }
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
        redirect(error ? "/entrar" : "/continuar");
      }
      return "Não foi possível enviar o e-mail de confirmação agora. Tente novamente em alguns minutos.";
    }
    if (message.includes("rate limit")) return "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.";
    return "Não foi possível criar sua conta agora. Tente novamente.";
  }
  if (!hasSession) redirect("/entrar?cadastro=confirmar");
  redirect("/onboarding");
}

export async function requestEmailChangeAction(_: FormState, formData: FormData): Promise<FormState> {
  const stored = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const newEmail = String(formData.get("newEmail") || "").trim().toLowerCase();
  if (!z.string().email().safeParse(newEmail).success) {
    const suggestion = suggestEmail(newEmail);
    return { status: "error", message: suggestion ? `Este e-mail parece incorreto. Você quis dizer ${suggestion}?` : "Digite um e-mail válido." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { status: "error", message: "Sua sessão expirou. Entre novamente." };
  if (newEmail === user.email.toLowerCase()) return { status: "error", message: "Este já é o e-mail da sua conta." };
  if (accountHasPassword(user)) {
    const password = String(formData.get("currentPassword") || "");
    if (!password || !await passwordMatches(user.email, password)) return { status: "error", message: "Senha atual incorreta." };
  }
  if (!appEmailConfigured()) return { status: "error", message: "O envio de e-mails não está configurado. Tente novamente mais tarde." };
  if (!await allowAuthEmail("email_change", newEmail)) return { status: "error", message: "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente." };
  const token = createEmailChangeToken({ uid: user.id, from: user.email.toLowerCase(), to: newEmail });
  try {
    await sendEmailChangeConfirmation({ to: newEmail, name: stored.name, link: `${getAppUrl()}/auth/email-change?token=${encodeURIComponent(token)}` });
  } catch (mailError) {
    console.error("email_change_mail_failed", mailError);
    return { status: "error", message: "Não foi possível enviar o e-mail de confirmação agora. Tente novamente em alguns minutos." };
  }
  return { status: "success", message: `Enviamos um link para ${newEmail}. Abra-o neste aparelho, conectado à sua conta, para concluir a troca.` };
}

export async function logoutAction() { const supabase = await createSupabaseServerClient(); await supabase.auth.signOut(); redirect("/"); }

// Review comments follow the chat rules; instead of publishing "####", the person rewrites the text.
function reviewTextError(reason: "contact" | "offensive") {
  return reason === "offensive"
    ? "Seu comentário tem palavrões, abreviações ofensivas ou ofensas. Reescreva para publicar."
    : "Seu comentário parece ter telefone, e-mail, link ou rede social. Contatos não podem ser publicados; reescreva para publicar.";
}

const IDENTITY_ERRORS: Record<string, string> = {
  invalid_cpf: "Digite um CPF válido.",
  underage_or_invalid_birth_date: "É preciso ter 18 anos ou mais para agendar conversas na Insidely.",
  cpf_in_use: "Este CPF já está vinculado a outra conta. Se for seu, fale com o suporte.",
  identity_already_registered: "Seus dados de identificação já estão registrados.",
};

// CPF and birth date of whoever books a conversation (see migration 20261029130000). Validated here
// for a friendly message and again by save_customer_identity.
// Returns an error message, or whether the CPF brought back an account this person had deleted.
async function saveCustomerIdentity(formData: FormData): Promise<{ error: string } | { reactivated: boolean }> {
  const cpf = cpfDigits(String(formData.get("cpf") || ""));
  const birthDate = String(formData.get("birthDate") || "");
  if (!isValidCpf(cpf)) return { error: IDENTITY_ERRORS.invalid_cpf };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !(ageOn(birthDate) >= 18) || ageOn(birthDate) > 120) return { error: IDENTITY_ERRORS.underage_or_invalid_birth_date };
  if (formData.get("identityConsent") !== "on") return { error: "Confirme que os dados são seus e autorize o uso descrito." };
  const { data: { user: authUser } } = await (await createSupabaseServerClient()).auth.getUser();
  if (!authUser || !await allowIdentityAttempt(authUser.id)) return { error: "Muitas tentativas de registrar CPF. Aguarde uma hora e tente novamente, ou fale com o suporte." };
  // save_customer_identity is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (await createSupabaseServerClient() as any).rpc("save_customer_identity", { p_cpf: cpf, p_birth_date: birthDate });
  if (!error) return { reactivated: data === "reactivated" };
  const code = Object.keys(IDENTITY_ERRORS).find((key) => error.message.includes(key));
  if (!code) console.error("save_customer_identity_failed", { message: error.message });
  return { error: code ? IDENTITY_ERRORS[code] : "Não foi possível salvar seus dados agora. Tente novamente." };
}

export async function saveCustomerIdentityAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser(undefined, { allowIncomplete: true });
  const result = await saveCustomerIdentity(formData);
  if ("error" in result) return { status: "error", message: result.error };
  // The old account is now this login: start over from /continuar so role and pages match it.
  if (result.reactivated) redirect("/continuar");
  revalidatePath("/dashboard/configuracoes");
  const next = String(formData.get("next") || "");
  if (next) redirect(safeInternalPath(next, "/dashboard"));
  return { status: "success", message: "Dados de identificação registrados." };
}

// Checks the public texts of a consultant profile; returns the error message or null.
// Headline and presentation are tidied before saving (lib/profile-text.ts); filler made of one
// repeated phrase is refused with a clear message.
function tidyProfileTexts(formData: FormData) {
  const bio = String(formData.get("bio") ?? "");
  if (bio && isRepetitive(bio)) return "A apresentação repete a mesma frase. Conte com suas palavras o que você vive no trabalho e sobre o que pode conversar.";
  if (formData.has("headline")) formData.set("headline", tidyHeadline(String(formData.get("headline"))));
  if (bio) formData.set("bio", tidyPresentation(bio));
  return null;
}

function profileTextError(formData: FormData, fields: [label: string, name: string][]) {
  const found = findUnsafeProfileText(fields.map(([label, name]) => [label, formData.getAll(name).map(String).join(" ")]));
  return found ? unsafeProfileTextMessage(found) : null;
}
const ONBOARDING_PROFILE_TEXTS: [string, string][] = [["Título profissional", "headline"], ["Cargo", "title"], ["Localização", "location"], ["O que você pode contextualizar", "bio"], ["O que você faz ou fazia na empresa", "experienceSummary"], ["Empresa", "companyIdName"], ["Área ou profissão", "professionIdName"]];

// The verification proves the main (first) experience. If a verified consultant swaps that company,
// the badge would vouch for a company nobody checked, so it is removed until a new proof is approved.
async function mainVerifiedCompany(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id, verificationStatus").eq("userId", userId).maybeSingle();
  if (!profile || profile.verificationStatus !== "VERIFIED") return null;
  const { data: experience } = await supabase.from("EmploymentExperience").select("companyId").eq("professionalProfileId", profile.id).order("isCurrent", { ascending: false }).order("startedAt", { ascending: false }).limit(1).maybeSingle();
  return { profileId: profile.id as string, companyId: (experience?.companyId ?? null) as string | null };
}

async function dropVerificationIfCompanyChanged(userId: string, before: Awaited<ReturnType<typeof mainVerifiedCompany>>) {
  if (!before) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: experience } = await supabase.from("EmploymentExperience").select("companyId").eq("professionalProfileId", before.profileId).order("isCurrent", { ascending: false }).order("startedAt", { ascending: false }).limit(1).maybeSingle();
  if ((experience?.companyId ?? null) === before.companyId) return false;
  const now = new Date().toISOString();
  await supabase.from("ProfessionalProfile").update({ verificationStatus: "NOT_SUBMITTED", updatedAt: now }).eq("id", before.profileId);
  await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId, title: "Selo de vínculo removido", body: "A empresa principal do seu perfil mudou, então o selo de vínculo verificado saiu. Envie um comprovante da nova empresa para recuperá-lo.", href: "/consultor/perfil", createdAt: now });
  return true;
}

type CatalogPending = { title: string; company: string | null; profession: string | null };

// A company or area typed with "Outra" (see CatalogPicker) is saved against the placeholder entry so
// the profile works right away; the typed name is queued afterwards by recordCatalogRequests.
function applyUnlistedCatalog(formData: FormData, companyField: string, professionField: string, titleField: string): CatalogPending | null {
  const pick = (field: string, placeholder: string) => {
    const typed = cleanCatalogName(String(formData.get(`${field}Name`) || ""));
    formData.delete(`${field}Name`);
    if (formData.get(field) || typed.length < 2) return null;
    formData.set(field, placeholder);
    return typed;
  };
  const company = pick(companyField, UNLISTED_COMPANY_ID);
  const profession = pick(professionField, UNLISTED_PROFESSION_ID);
  return company || profession ? { title: String(formData.get(titleField) || "").trim().slice(0, 160), company, profession } : null;
}

async function recordCatalogRequests(userId: string, pending: (CatalogPending | null)[]) {
  const items = pending.filter((item): item is CatalogPending => Boolean(item));
  if (!items.length) return;
  // CatalogRequest and the pending columns are added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", userId).maybeSingle();
  if (!profile) return;
  const created: { kind: string; name: string }[] = [];
  for (const item of items) {
    // Experiences are recreated on every profile save, so the typed names are written back each time.
    let query = supabase.from("EmploymentExperience").update({ ...(item.company ? { pendingCompanyName: item.company } : {}), ...(item.profession ? { pendingProfessionName: item.profession } : {}) }).eq("professionalProfileId", profile.id).eq("title", item.title);
    if (item.company) query = query.eq("companyId", UNLISTED_COMPANY_ID);
    if (item.profession) query = query.eq("professionId", UNLISTED_PROFESSION_ID);
    const { error: experienceError } = await query;
    if (experienceError) console.error("catalog_pending_experience_failed", { error: experienceError });
    for (const [kind, name] of [["COMPANY", item.company], ["PROFESSION", item.profession]] as const) {
      if (!name) continue;
      const { data: existing } = await supabase.from("CatalogRequest").select("id").eq("kind", kind).eq("normalizedName", catalogKey(name)).eq("userId", userId).eq("status", "PENDING").maybeSingle();
      if (existing) continue;
      const { error } = await supabase.from("CatalogRequest").insert({ kind, name, normalizedName: catalogKey(name), userId });
      if (error) console.error("catalog_request_failed", { error });
      else created.push({ kind, name });
    }
  }
  if (!created.length) return;
  const { data: admins } = await supabase.from("User").select("id").eq("role", "ADMIN");
  const now = new Date().toISOString();
  const rows = (admins ?? []).flatMap((admin: { id: string }) => created.map((item) => ({ id: crypto.randomUUID(), userId: admin.id, title: item.kind === "COMPANY" ? "Nova empresa para análise" : "Nova área de atuação para análise", body: `Um consultor pediu para adicionar “${item.name}”.`, href: "/admin/catalogo", createdAt: now })));
  if (rows.length) await supabase.from("Notification").insert(rows);
}

export async function completeOnboardingAction(_: string | undefined, formData: FormData) {
  const user = await requireUser(undefined, { allowIncomplete: true });
  const role = formData.get("role") === "CONSULTANT" ? Role.CONSULTANT : Role.USER;
  if (formData.get("terms") !== "on") return "Aceite os termos da plataforma.";
  // Every account, customer or consultant, registers its identity before using the platform.
  const identity = await saveCustomerIdentity(formData);
  if ("error" in identity && identity.error !== IDENTITY_ERRORS.identity_already_registered) return identity.error;
  // Same CPF as an account this person deleted: that account came back, so this sign-up ends here.
  if ("reactivated" in identity && identity.reactivated) redirect("/continuar");
  for (const key of ["cpf", "birthDate", "identityConsent"]) formData.delete(key);
  if (role === Role.CONSULTANT) { const tidyError = tidyProfileTexts(formData); if (tidyError) return tidyError; const textError = profileTextError(formData, ONBOARDING_PROFILE_TEXTS); if (textError) return textError; }
  const period = role === Role.CONSULTANT ? readEmploymentPeriod(formData) : null;
  if (typeof period === "string") return period;
  const catalog = role === Role.CONSULTANT ? applyUnlistedCatalog(formData, "companyId", "professionId", "title") : null;
  if (role === Role.CONSULTANT && formData.get("confidentiality") !== "on") return "Aceite o termo de confidencialidade para consultores.";
  await rpc("complete_onboarding", { p_role: role, p_payload: formText(formData) });
  if (period) await saveEmploymentPeriod(user.id, period);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("User").update({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() }).eq("id", user.id);
  await recordCatalogRequests(user.id, [catalog]);
  const next = String(formData.get("next") || "");
  // Absolute URL: the dashboard loads in a fresh request, which sees the finished sign-up.
  redirect(`${getAppUrl()}${next ? safeInternalPath(next, role === Role.CONSULTANT ? "/consultor" : "/dashboard") : role === Role.CONSULTANT ? "/consultor" : "/dashboard"}`);
}

// A customer account adds a consultant profile and keeps everything it had as a customer.
export async function becomeConsultantAction(_: string | undefined, formData: FormData) {
  const user = await requireUser([Role.USER]);
  if (formData.get("terms") !== "on") return "Aceite os termos para consultores.";
  if (formData.get("confidentiality") !== "on") return "Aceite o termo de confidencialidade para consultores.";
  const tidyError = tidyProfileTexts(formData);
  if (tidyError) return tidyError;
  const textError = profileTextError(formData, ONBOARDING_PROFILE_TEXTS);
  if (textError) return textError;
  const period = readEmploymentPeriod(formData);
  if (typeof period === "string") return period;
  const catalog = applyUnlistedCatalog(formData, "companyId", "professionId", "title");
  // become_consultant is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (await createSupabaseServerClient() as any).rpc("become_consultant", { p_payload: formText(formData) });
  if (error) {
    if (error.message.includes("already_consultant")) redirect("/consultor");
    if (error.message.includes("invalid_onboarding_data")) return "Revise os campos: título, cargo, empresa, área, localização e uma descrição com pelo menos 30 caracteres.";
    console.error("become_consultant_failed", { message: error.message });
    return "Não foi possível criar seu perfil de consultor agora. Tente novamente.";
  }
  await saveEmploymentPeriod(user.id, period);
  await recordCatalogRequests(user.id, [catalog]);
  revalidatePath("/dashboard");
  revalidatePath("/consultor");
  redirect("/consultor/perfil?novo=1");
}

export async function toggleFavoriteAction(profileId: string) { const user = await requireUser(); const { data: target } = await createSupabaseServiceClient().from("ProfessionalProfile").select("userId").eq("id", profileId).maybeSingle(); if (target?.userId === user.id) return; /* no favoriting your own profile */ await rpc("toggle_favorite", { p_profile_id: profileId }); revalidatePath("/dashboard/favoritos"); revalidatePath("/dashboard"); revalidatePath(`/profissional/${profileId}`); }
export async function createBookingAction(profileId: string, _previousState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const slot = String(formData.get("slot") || "");
  const duration = Number(formData.get("duration")) === 60 ? 60 : 30;
  let goals = maskUnsafeGoal(String(formData.get("goals") || "").trim());
  for (const namePart of user.name.split(/\s+/).filter((part) => part.length >= 3)) {
    goals = goals.replace(new RegExp(`\\b${namePart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "giu"), (match) => "*".repeat(match.length));
  }
  if (!slot) return { status: "error", message: "Selecione um horário antes de continuar. Seus temas e seu texto continuam salvos aqui." };
  if (goals.length < 12) return { status: "error", message: "Conte um pouco mais sobre o que você precisa decidir (mínimo de 12 caracteres)." };
  let booking: string;
  try {
    booking = await rpc("create_booking", { p_profile_id: profileId, p_slot_id: slot, p_duration: duration, p_topics: formData.getAll("topics").map(String), p_goals: goals });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (process.env.E2E_MOCK_EXTERNALS === "true") console.error("[E2E] create_booking failed", message);
    if (message.includes("slot_too_soon") || message.includes("slot_unavailable")) return { status: "error", message: "Esse horário acabou de ficar indisponível. Escolha outro horário; seus temas e seu texto continuam salvos." };
    if (message.includes("unauthorized")) return { status: "error", message: "Sua sessão expirou. Entre novamente para continuar." };
    if (message.includes("blocked")) return { status: "error", message: "Não é possível agendar com este consultor." };
    if (message.includes("consultant_paused")) return { status: "error", message: "Este consultor está com a agenda pausada no momento." };
    if (message.includes("account_suspended")) return { status: "error", message: "Este agendamento não está disponível no momento." };
    if (message.includes("consultant_identity_required")) return { status: "error", message: "Este consultor ainda não concluiu o cadastro e não pode receber agendamentos no momento." };
    if (message.includes("identity_required")) return { status: "error", message: "Antes de agendar, registre seu CPF e sua data de nascimento. Recarregue a página para ver o formulário." };
    return { status: "error", message: "Não foi possível criar a solicitação agora. Seus dados continuam no formulário; tente novamente." };
  }
  // Sent after the response so the checkout opens without waiting on the mail server.
  const checkoutUrl = `${getAppUrl()}/checkout/${booking}`;
  after(() => sendPaymentInstructionsEmail(createSupabaseServiceClient(), booking, checkoutUrl).catch((error) => console.error("payment_instructions_email_failed", { booking, error })));
  redirect(`/checkout/${booking}`);
}

export async function createStripeCheckoutAction(id: string) {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  try {
    const url = await createBookingCheckout({ bookingId: id, customerId: user.id, customerEmail: user.email, customerName: user.name, appUrl: getAppUrl() });
    if (!url) throw new Error("O Stripe não retornou uma URL de checkout.");
    redirect(url);
  } catch (error) {
    // Next implements redirect() by throwing a framework control-flow error.
    // It must escape this catch instead of becoming ?erro=NEXT_REDIRECT.
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.";
    redirect(`/checkout/${id}?erro=${encodeURIComponent(message)}`);
  }
}

export async function simulateBookingPaymentAction(id: string, formData: FormData) {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const method = String(formData.get("method") || "");
  if (!["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"].includes(method)) {
    redirect(`/checkout/${id}?erro=${encodeURIComponent("Selecione uma forma de pagamento.")}`);
  }

  // Expire stale requests first so a booking past its 30-minute payment window cannot be paid.
  await (await createSupabaseServerClient()).rpc("expire_past_unpaid_bookings", {});

  // The provider metadata columns are maintained by migrations beyond the generated legacy type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const [{ data: booking, error: bookingError }, { data: payment, error: paymentError }] = await Promise.all([
    supabase.from("Booking").select("id, customerId, professionalProfileId, status, startsAt").eq("id", id).eq("customerId", user.id).maybeSingle(),
    supabase.from("Payment").select("id, status").eq("bookingId", id).maybeSingle(),
  ]);
  if (bookingError || !booking) notFound();
  if (booking.status !== "PENDING_PAYMENT") redirect(`/checkout/${id}`);

  const now = new Date().toISOString();
  if (paymentError || !payment) redirect(`/checkout/${id}?erro=${encodeURIComponent("Não foi possível localizar o pagamento.")}`);
  if (payment.status === "PENDING") {
    const { error } = await supabase.from("Payment").update({
      status: "PAID_HELD", provider: "SIMULATION", providerRef: `demo-${method.toLowerCase()}-${id}`,
      paidAt: now, updatedAt: now,
    }).eq("id", payment.id).eq("status", "PENDING");
    if (error) redirect(`/checkout/${id}?erro=${encodeURIComponent("Não foi possível confirmar o pagamento simulado.")}`);
    const { error: confirmError } = await supabase.from("Booking").update({
      status: "CONFIRMED", paymentConfirmedAt: now, updatedAt: now,
    }).eq("id", id).eq("status", "PENDING_PAYMENT");
    if (confirmError) redirect(`/checkout/${id}?erro=${encodeURIComponent("Pagamento registrado, mas não foi possível confirmar o agendamento.")}`);
    // The Meet room is only created once the conversation starts (/sala creates it on the first
    // visit); this only does anything for an immediate conversation that is already under way.
    try { await ensureGoogleMeetForBooking(supabase, id); }
    catch (error) { console.error("simulated_payment_meet_creation_failed", { bookingId: id, error }); }
    await postWelcomeMessage(supabase, id).catch((error) => console.error("welcome_message_failed", { bookingId: id, error }));
    // Notifications and e-mails run after the response: the payment is already confirmed, so the
    // customer sees the confirmation without waiting on them.
    after(async () => {
      const { data: consultantProfile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
      const notificationRows = [
        { id: crypto.randomUUID(), userId: booking.customerId, title: "Conversa confirmada", body: `Sua conversa é em ${shortDate(parseDbDate(booking.startsAt))}. O link da sala está no chat da conversa e no seu e-mail; ele abre no horário marcado.`, href: "/dashboard/mensagens", createdAt: now },
        ...(consultantProfile?.userId ? [{ id: crypto.randomUUID(), userId: consultantProfile.userId, title: "Nova conversa confirmada", body: `Conversa marcada para ${shortDate(parseDbDate(booking.startsAt))}. O link da sala está no chat da consulta e no seu e-mail; ele abre no horário marcado.`, href: "/consultor/consultas", createdAt: now }] : []),
      ];
      const { error: notificationError } = await supabase.from("Notification").insert(notificationRows);
      if (notificationError) console.error("simulated_payment_notification_failed", { bookingId: id, error: notificationError });
      try { await sendBookingConfirmationEmails(supabase, id); }
      catch (error) { console.error("simulated_payment_email_failed", { bookingId: id, error }); }
    });
  }

  revalidatePath(`/checkout/${id}`);
  revalidatePath("/dashboard/agendamentos");
  revalidatePath("/dashboard");
  revalidatePath("/consultor/consultas");
  redirect(`/checkout/${id}?status=simulated`);
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

export async function createAvailabilityAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const startsAt = new Date(String(formData.get("startsAt") || ""));
  const duration = Number(formData.get("duration"));
  if (Number.isNaN(startsAt.getTime()) || ![30, 60].includes(duration)) return { status: "error", message: "Escolha uma data e duração válidas." };
  try {
    await rpc("create_consultant_availability", { p_user_id: user.id, p_starts_at: startsAt.toISOString(), p_ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString() });
    revalidatePath("/consultor/agenda");
    revalidatePath("/buscar");
    after(() => notifyAvailabilityWatchers(user.id).catch((error) => console.error("availability_watch_failed", { error })));
    return { status: "success", message: "Horário adicionado à sua agenda e ao seu perfil." };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("invalid_time_range")) return { status: "error", message: "Escolha um horário que não tenha terminado há mais de um minuto." };
    if (message.includes("availability_conflict")) return { status: "error", message: "Esse horário se sobrepõe a outro da sua agenda." };
    return { status: "error", message: "Não foi possível salvar este horário. Tente novamente." };
  }
}

export async function createInstantAvailabilityAction(): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const startsAt = new Date();
  try {
    await rpc("create_consultant_availability", { p_user_id: user.id, p_starts_at: startsAt.toISOString(), p_ends_at: new Date(startsAt.getTime() + 30 * 60_000).toISOString() });
    revalidatePath("/consultor/agenda");
    revalidatePath("/buscar");
    after(() => notifyAvailabilityWatchers(user.id).catch((error) => console.error("availability_watch_failed", { error })));
    return { status: "success", message: "Disponibilidade imediata aberta por 30 minutos." };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("availability_conflict")) return { status: "error", message: "Esse horário se sobrepõe a outro da sua agenda." };
    return { status: "error", message: "Não foi possível abrir a disponibilidade imediata. Tente novamente." };
  }
}
export async function removeAvailabilityAction(id: string) { await requireUser([Role.CONSULTANT]); try { await rpc("remove_consultant_availability", { p_availability_id: id }); } catch (error) { console.error("remove_availability_failed", { id, error }); /* booked meanwhile: the refreshed agenda shows it as reserved */ } revalidatePath("/consultor/agenda"); revalidatePath("/buscar"); }
export async function completeBookingAction(id: string) { await requireUser([Role.CONSULTANT]); await confirmConversationAction(id); }
export async function confirmConversationAction(id: string) { await requireUser(); await rpc("confirm_booking", { p_booking_id: id }); // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createSupabaseServiceClient() as any; const { data: payment } = await service.from("Payment").select("provider").eq("bookingId", id).maybeSingle(); if (payment?.provider !== "SIMULATION") { try { await releaseBookingTransfer(id); } catch { /* O webhook/cron pode concluir o repasse depois. */ } } revalidatePath("/dashboard/agendamentos"); revalidatePath("/consultor/consultas"); revalidatePath("/consultor/ganhos"); }
export async function disputeBookingAction(id: string, formData: FormData) { await requireUser(); const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/dashboard/agendamentos"); const description = String(formData.get("description") || "").trim(); if (description.length < 20 || description.length > 2000) redirect(`${returnTo}?contestacao=curta`); let ok = true; try { await rpc("dispute_booking", { p_booking_id: id, p_description: description }); } catch (error) { ok = false; console.error("dispute_failed", { bookingId: id, error }); } revalidatePath("/dashboard/agendamentos"); revalidatePath("/consultor/consultas"); redirect(`${returnTo}?contestacao=${ok ? "ok" : "erro"}`); }
export async function submitReviewAction(_: FormState, formData: FormData): Promise<FormState> { await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]); const rating = Number(formData.get("rating")); const comment = String(formData.get("comment") || ""); if (!Number.isInteger(rating) || rating < 0 || rating > 5 || comment.length > 2000) return { status: "error", message: "Revise sua avaliação." }; const commentCheck = comment.trim() ? moderateChatMessage(comment, { countScatteredDigits: false }) : { allowed: true as const }; if (!commentCheck.allowed) return { status: "error", message: reviewTextError(commentCheck.reason) }; try { await rpc("create_review", { p_booking_id: String(formData.get("bookingId")), p_rating: rating, p_comment: comment.trim().slice(0, 2000) }); } catch { return { status: "error", message: "Esta conversa já foi avaliada ou não pode ser avaliada." }; } revalidatePath("/dashboard/avaliacoes"); revalidatePath("/profissional/[id]", "page"); return { status: "success", message: "Avaliação publicada." }; }
export async function updateConsultantRecordingConsentAction(id: string, formData: FormData) { await requireUser([Role.CONSULTANT]); await rpc("set_recording_consent", { p_booking_id: id, p_consented: formData.get("recordingConsent") === "on" }); revalidatePath("/consultor/consultas"); }
export async function cancelBookingAction(id: string, formData: FormData) {
  const user = await requireUser([Role.CONSULTANT]);
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 10 || reason.length > 500) redirect("/consultor/consultas?cancelamento=motivo");
  try {
    const result = await cancelBookingAndRefund({ bookingId: id, consultantId: user.id, reason });
    try { await sendBookingCancellationEmail(createSupabaseServiceClient(), id, reason, result.refunded); } catch (error) { console.error("booking_cancellation_email_failed", { bookingId: id, error }); }
    revalidatePath("/consultor"); revalidatePath("/consultor/consultas"); revalidatePath("/dashboard"); revalidatePath("/dashboard/agendamentos");
    redirect("/consultor/consultas?cancelamento=ok");
  } catch (error) {
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    console.error("booking_cancellation_failed", { bookingId: id, error });
    redirect("/consultor/consultas?cancelamento=erro");
  }
}
export async function sendMessageAction(id: string, formData: FormData) {
  const user = await requireUser();
  const body = String(formData.get("body") || "").trim();
  const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/dashboard/mensagens");
  if (!body) return;
  // The chat only opens 24 h before the conversation and closes when it ends (booking-policy.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chatBooking } = await (createSupabaseServiceClient() as any).from("Conversation").select("booking:Booking(status, startsAt, durationMinutes)").eq("id", id).maybeSingle();
  const chat = Array.isArray(chatBooking?.booking) ? chatBooking.booking[0] : chatBooking?.booking;
  if (!chat || !canSendBookingMessage(chat.status, parseDbDate(chat.startsAt), chat.durationMinutes)) redirect(`${returnTo}?mensagem=fechado`);
  if (body.length > 2000) redirect(`${returnTo}?mensagem=longa`);
  const moderation = moderateChatMessage(body);
  if (!moderation.allowed) {
    // Kept for the admin moderation queue; repeated attempts are a reason to review the account.
    // Capped per hour so a script cannot fill the table; the message is refused either way.
    const { error } = !await consumeQuota(`moderation-log:${user.id}`, 30, 3600) ? { error: null } : await createSupabaseServiceClient().from("ChatModerationEvent" as never).insert({ userId: user.id, conversationId: id, reason: moderation.reason, excerpt: body.slice(0, 500) } as never);
    if (error) console.error("chat_moderation_log_failed", { error });
    redirect(`${returnTo}?mensagem=${moderation.reason === "offensive" ? "ofensiva" : "bloqueada"}`);
  }
  try { await rpc("send_message", { p_conversation_id: id, p_body: body }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(`${returnTo}?mensagem=${message.includes("offensive_language") ? "ofensiva" : message.includes("contact_sharing") ? "bloqueada" : message.includes("rate_limited") ? "limite" : "erro"}`);
  }
  revalidatePath(returnTo);
  revalidatePath("/dashboard/mensagens");
  revalidatePath("/consultor/consultas");
}
export async function updateAccountNameAction(_: FormState, formData: FormData): Promise<FormState> { const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]); const name = formatPersonName(String(formData.get("name") || "")); if (name.length < 2 || name.length > 80) return { status: "error", message: "Digite um nome entre 2 e 80 caracteres." }; const supabase = await createSupabaseServerClient(); const { error } = await supabase.from("User").update({ name, updatedAt: new Date().toISOString() }).eq("id", user.id); if (error) return { status: "error", message: "Não foi possível atualizar seu nome agora." }; revalidatePath("/dashboard"); revalidatePath("/dashboard/configuracoes"); revalidatePath("/dashboard/mensagens"); revalidatePath("/consultor"); return { status: "success", message: "Nome atualizado." }; }
export async function updatePrivacyAction(formData: FormData) { await requireUser([Role.CONSULTANT]); const keys = ["showRealName", "showSurname", "showPhoto", "showAgeRange", "showCurrentCompany", "showFullHistory", "showExactDates", "showCity", "searchableByCompany", "searchableByProfession"]; const payload = Object.fromEntries(keys.map((key) => [key, formData.get(key) === "on"])); await rpc("update_privacy", { p_payload: payload }); revalidatePath("/consultor/privacidade"); redirect("/consultor/privacidade?salvo=1"); }
export async function updateProfessionalProfileAction(_: string | undefined, formData: FormData) { const user = await requireUser([Role.CONSULTANT]); const tidyError = tidyProfileTexts(formData); if (tidyError) return tidyError; const textError = profileTextError(formData, [["Título profissional", "headline"], ["Sobrenome público", "publicSurname"], ["Nome público", "pseudonym"], ["Cidade/UF", "location"], ["Apresentação", "bio"], ["Temas", "topics"], ["Limites", "boundaries"], ...[0, 1, 2].flatMap((index): [string, string][] => [[`Cargo da experiência ${index + 1}`, `title${index}`], [`Área da experiência ${index + 1}`, `area${index}`], [`Resumo da experiência ${index + 1}`, `summary${index}`], [`Empresa da experiência ${index + 1}`, `companyId${index}Name`], [`Profissão da experiência ${index + 1}`, `professionId${index}Name`]])]); if (textError) return textError; const catalog = [0, 1, 2].map((index) => applyUnlistedCatalog(formData, `companyId${index}`, `professionId${index}`, `title${index}`)); const payload = formText(formData); const pseudonym = String(formData.get("pseudonym") || "").trim(); if (/[\w.+-]+@[\w.-]+[.][a-z]{2,}/i.test(pseudonym) || pseudonym.replace(/\D/g, "").length >= 10) return "O nome público não pode conter e-mail ou telefone."; const price30 = Number(String(formData.get("price30Cents") || "").replace(",", ".")); const price60 = Number(String(formData.get("price60Cents") || "").replace(",", ".")); if (!Number.isFinite(price30) || !Number.isFinite(price60) || price30 < 10 || price60 < 10) return "O valor mínimo é R$ 10,00 por sessão."; const experiences = [0, 1, 2].map((index) => ({ id: String(formData.get(`experienceId${index}`) || ""), companyId: String(formData.get(`companyId${index}`) || ""), professionId: String(formData.get(`professionId${index}`) || ""), title: String(formData.get(`title${index}`) || ""), area: String(formData.get(`area${index}`) || ""), isCurrent: formData.get(`isCurrent${index}`) === "on", startedAt: String(formData.get(`startedAt${index}`) || ""), endedAt: String(formData.get(`endedAt${index}`) || ""), summary: String(formData.get(`summary${index}`) || "") })).filter((item) => item.companyId && item.professionId && item.title && item.startedAt);
  // Current or former job: a former one needs the date the person left, after the date they joined.
  const thisMonth = new Date().toISOString().slice(0, 7);
  for (const [index, item] of experiences.entries()) {
    if (item.startedAt.slice(0, 7) > thisMonth) return `Experiência ${index + 1}: a data de entrada não pode estar no futuro.`;
    if (item.endedAt && item.endedAt.slice(0, 7) > thisMonth) return `Experiência ${index + 1}: a data de saída não pode estar no futuro.`;
    if (item.isCurrent) item.endedAt = "";
    else if (!item.endedAt) return `Experiência ${index + 1}: informe quando você saiu da empresa ou marque "Ainda trabalho nesta empresa".`;
    if (item.endedAt && item.endedAt < item.startedAt) return `Experiência ${index + 1}: a data de saída precisa ser depois da data de entrada.`;
  }
  const before = await mainVerifiedCompany(user.id); await rpc("update_professional_profile", { p_payload: { ...payload, price30Cents: String(Math.round(price30 * 100)), price60Cents: String(Math.round(price60 * 100)), experiences } }); await recordCatalogRequests(user.id, catalog); const dropped = await dropVerificationIfCompanyChanged(user.id, before); revalidatePath("/consultor"); revalidatePath("/consultor/perfil"); revalidatePath("/profissional/me"); return dropped ? "Perfil atualizado. Como a empresa principal mudou, o selo de vínculo verificado saiu; envie um comprovante da nova empresa em Verificação." : catalog.some(Boolean) ? "Perfil profissional atualizado. As empresas ou áreas novas foram enviadas para análise." : "Perfil profissional atualizado."; }
export async function submitVerificationAction(_: string | undefined, formData: FormData) { await requireUser([Role.CONSULTANT]); const file = formData.get("document"); if (!(file instanceof File) || file.size === 0) return "Anexe um comprovante."; const allowed = ["application/pdf","image/jpeg","image/png","image/webp"]; if (!allowed.includes(file.type) || file.size > 5*1024*1024 || !await hasValidFileSignature(file)) return "Envie um PDF, JPG, PNG ou WEBP válido de até 5 MB."; const supabase = await createSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return "Sua sessão expirou."; const extension=file.type==="application/pdf"?"pdf":file.type==="image/jpeg"?"jpg":file.type.split("/")[1]; const path = `${user.id}/${crypto.randomUUID()}.${extension}`; const upload = await supabase.storage.from("verification-documents").upload(path, file, { upsert: false, contentType:file.type }); if (upload.error) return "Não foi possível enviar o documento."; const method = String(formData.get("method") || ""); if (!VERIFICATION_METHODS.some((item) => item.value === method)) { await supabase.storage.from("verification-documents").remove([path]); return "Escolha o tipo de comprovante."; } try { await rpc("submit_verification", { p_storage_key: path, p_original_name: file.name.replace(/[^\p{L}\p{N}._ -]/gu,"_").slice(0,120), p_mime_type: file.type, p_size_bytes: file.size, p_method: method }); } catch (error) { await supabase.storage.from("verification-documents").remove([path]); return error instanceof Error && error.message.includes("verification_pending") ? "Você já tem um comprovante em análise. Aguarde a resposta da equipe." : "Não foi possível enviar o comprovante agora. Tente novamente."; } await linkVerificationExperience(formData); revalidatePath("/consultor"); revalidatePath("/consultor/perfil"); return "Comprovante enviado. A equipe da Insidely vai analisar e você recebe uma notificação com o resultado."; }
export async function updateProfileImageAction(_: string | undefined, formData: FormData) { const stored = await requireUser(); const file = formData.get("image"); if (!(file instanceof File)) return "Escolha uma foto."; if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !await hasValidFileSignature(file)) return "Use uma imagem PNG, JPG ou WEBP válida."; if (file.size > 3 * 1024 * 1024) return "A foto deve ter no máximo 3 MB."; const moderation = await moderateImage(file); if (!moderation.allowed) return imageModerationMessage(moderation.reason, "foto de perfil"); const supabase = await createSupabaseServerClient(); const { data: authData, error: authError } = await supabase.auth.getUser(); if (authError || !authData.user) return "Sua sessão expirou. Entre novamente."; const path = `avatars/${authData.user.id}/${crypto.randomUUID()}-${file.name}`; const bucket = supabase.storage.from("avatars"); const upload = await bucket.upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" }); if (upload.error) return `Não foi possível enviar a foto: ${upload.error.message}`; const oldPath = avatarStoragePath(stored.image, authData.user.id); const { data } = bucket.getPublicUrl(path); const { error } = await supabase.rpc("update_profile_image", { p_image: data.publicUrl }); if (error) { await bucket.remove([path]); return `A foto foi enviada, mas não pôde ser salva no perfil: ${error.message}`; } if (oldPath && oldPath !== path) await bucket.remove([oldPath]); revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor"); revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); return "Foto atualizada."; }
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
  const moderation = await moderateImage(file);
  if (!moderation.allowed) return imageModerationMessage(moderation.reason, "capa");
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
  revalidatePath("/consultor"); revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); revalidatePath("/profissional/[id]", "page");
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
  revalidatePath("/consultor"); revalidatePath("/consultor/perfil"); revalidatePath("/consultor"); revalidatePath("/profissional/[id]", "page");
}
export async function deleteAccountAction(_: string | undefined, formData: FormData) { const user = await requireUser(); const confirmation = String(formData.get("confirmation") || "").trim().toLowerCase(); if (confirmation !== user.email.trim().toLowerCase()) return "Digite exatamente o e-mail da sua conta para confirmar a exclusão."; const supabase = await createSupabaseServerClient(); const { error } = await supabase.functions.invoke("delete-account", { body: { confirmation } }); if (error) { let code = ""; try { code = String((await (error as { context?: Response }).context?.json())?.error ?? ""); } catch { /* resposta sem corpo JSON */ } return code === "active_obligations" ? "Você tem conversas pendentes, agendadas ou em andamento. Conclua, cancele ou aguarde o fim delas antes de excluir a conta." : "Não foi possível excluir a conta agora. Tente novamente ou fale com o suporte."; } await supabase.auth.signOut(); redirect("/?conta=excluida"); }
export async function submitSupportAction(formData: FormData) { await requireUser(undefined, { allowSuspended: true }); const { error } = await (await createSupabaseServerClient()).rpc("create_support_report", { p_category: String(formData.get("category") || ""), p_description: String(formData.get("description") || "") }); redirect(error ? `/suporte?erro=${error.message.includes("rate_limited") ? "limite" : "1"}` : "/suporte?enviado=1"); }
async function markNotificationRead(id: string, userId: string) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("Notification").update({ readAt: new Date().toISOString() }).eq("id", id).eq("userId", userId).is("readAt", null);
  if (error) throw new Error(`Não foi possível marcar a notificação como lida: ${error.message}`);
}
export async function markNotificationReadAction(id: string) { const user = await requireUser(); await markNotificationRead(id, user.id); revalidatePath("/dashboard"); revalidatePath("/consultor"); }
export async function markAllNotificationsReadAction() { const user = await requireUser(); const supabase = createSupabaseServiceClient(); const { error } = await supabase.from("Notification").update({ readAt: new Date().toISOString() }).eq("userId", user.id).is("readAt", null); if (error) throw new Error(`Não foi possível marcar as notificações como lidas: ${error.message}`); revalidatePath("/dashboard"); revalidatePath("/consultor"); }
export async function clearAllNotificationsAction() { const user = await requireUser(); const supabase = createSupabaseServiceClient(); const { error } = await supabase.from("Notification").delete().eq("userId", user.id); if (error) throw new Error(`Não foi possível limpar as notificações: ${error.message}`); revalidatePath("/dashboard"); revalidatePath("/consultor"); }
export async function archiveCustomerBookingAction(id: string) { await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]); const supabase = await createSupabaseServerClient(); const { error } = await supabase.rpc("archive_customer_booking", { p_booking_id: id }); if (error) throw new Error("Não foi possível ocultar este histórico agora."); revalidatePath("/dashboard/agendamentos"); revalidatePath("/dashboard/mensagens"); }
export async function openNotificationAction(id: string, href: string) { const user = await requireUser(); await markNotificationRead(id, user.id); revalidatePath("/dashboard"); revalidatePath("/consultor"); redirect(safeInternalPath(href)); }
export async function reportProfileAction(profileId: string, formData: FormData) { await requireUser(); const category = String(formData.get("category") || ""); const description = String(formData.get("description") || "").trim(); if (description.length < 20 || description.length > 2000) redirect(`/profissional/${profileId}?denuncia=erro`); await rpc("create_profile_report", { p_profile_id: profileId, p_category: category, p_description: description }); redirect(`/profissional/${profileId}?denuncia=enviada`); }
export async function reviewVerificationAction(id: string, decision: "VERIFIED" | "REJECTED", formData?: FormData) {
  const actor = await requireUser([Role.ADMIN]); after(() => logAdminAction(actor.id, "review_verification", null, `${decision} ${id}`));
  await adminAction(decision === "VERIFIED" ? "verify_verification" : "reject_verification", id);
  // admin_review_verification already notified the consultant; a rejection reason is added to it.
  const reason = String(formData?.get("reason") || "").trim().slice(0, 400);
  if (decision === "REJECTED" && reason) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseServiceClient() as any;
    const { data: verification } = await supabase.from("Verification").update({ adminNotes: reason, updatedAt: new Date().toISOString() }).eq("id", id).select("professionalProfileId").maybeSingle();
    const { data: profile } = verification ? await supabase.from("ProfessionalProfile").select("userId").eq("id", verification.professionalProfileId).maybeSingle() : { data: null };
    if (profile) await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: profile.userId, title: "Motivo da recusa do comprovante", body: `${reason} Você pode enviar outro comprovante em Perfil e verificação.`, href: "/consultor/perfil", createdAt: new Date().toISOString() });
  }
  revalidatePath("/admin/verificacoes"); revalidatePath("/admin"); revalidatePath("/consultor/perfil"); revalidatePath("/buscar"); revalidatePath("/profissional/[id]", "page");
  redirect(`/admin/verificacoes?ok=${decision === "VERIFIED" ? "aprovado" : "recusado"}`);
}
export async function resolveReportAction(id: string) { const actor = await requireUser([Role.ADMIN]); after(() => logAdminAction(actor.id, "resolve_report", null, id)); await adminAction("resolve_report", id); revalidatePath("/admin/denuncias"); revalidatePath("/admin/suporte"); revalidatePath("/admin"); }
export async function customerCancelBookingAction(id: string, formData: FormData) {
  const user = await requireUser();
  let ok = true;
  const reason = String(formData.get("reason") || "").trim().slice(0, 300);
  if (reason.length < 10) redirect("/dashboard/agendamentos?cancelamento=motivo");
  try {
    await refundCustomerCancellation({ bookingId: id, customerId: user.id });
    await rpc("customer_cancel_booking", { p_booking_id: id, p_reason: reason });
  }
  catch (error) { ok = false; console.error("customer_cancel_failed", { bookingId: id, error }); }
  if (ok) { try { await sendCustomerCancellationEmail(createSupabaseServiceClient(), id, reason); } catch (error) { console.error("customer_cancellation_email_failed", { bookingId: id, error }); } }
  revalidatePath("/dashboard"); revalidatePath("/dashboard/agendamentos"); revalidatePath("/consultor/consultas");
  redirect(`/dashboard/agendamentos?cancelamento=${ok ? "ok" : "erro"}`);
}

// Admin catalog queue: a typed company/area becomes a new entry (or is matched to an existing one),
// and every experience waiting on that name moves from the placeholder to it.
export async function resolveCatalogRequestAction(formData: FormData) {
  const actor = await requireUser([Role.ADMIN]); after(() => logAdminAction(actor.id, "resolve_catalog", null, `${String(formData.get("decision"))} ${String(formData.get("kind"))}: ${String(formData.get("key"))}`));
  const kind = formData.get("kind") === "PROFESSION" ? "PROFESSION" : "COMPANY";
  const key = String(formData.get("key") || "");
  const decision = String(formData.get("decision") || "");
  const table = kind === "COMPANY" ? "Company" : "Profession";
  const idColumn = kind === "COMPANY" ? "companyId" : "professionId";
  const pendingColumn = kind === "COMPANY" ? "pendingCompanyName" : "pendingProfessionName";
  const placeholder = kind === "COMPANY" ? UNLISTED_COMPANY_ID : UNLISTED_PROFESSION_ID;
  // CatalogRequest and the pending columns are added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  // Back to the same tab (companies or areas) after each decision.
  const tab = kind === "COMPANY" ? "empresas" : "areas";
  const { data: requests } = await supabase.from("CatalogRequest").select("id, userId, name").eq("kind", kind).eq("normalizedName", key).eq("status", "PENDING");
  if (!requests?.length) redirect(`/admin/catalogo?tipo=${tab}`);
  const now = new Date().toISOString();

  let targetId: string | null = null;
  let targetName = "";
  if (decision === "existing") {
    targetId = String(formData.get("existingId") || "");
    const { data: existing } = await supabase.from(table).select("id, name").eq("id", targetId).maybeSingle();
    if (!existing || UNLISTED_IDS.has(existing.id)) redirect(`/admin/catalogo?tipo=${tab}&erro=${encodeURIComponent("Escolha um item existente do catálogo.")}`);
    targetName = existing.name;
  } else if (decision === "new") {
    targetName = cleanCatalogName(String(formData.get("name") || ""));
    const group = cleanCatalogName(String(formData.get("group") || "")) || (kind === "COMPANY" ? "Não informado" : "Outras");
    if (targetName.length < 2) redirect(`/admin/catalogo?tipo=${tab}&erro=${encodeURIComponent("Informe o nome.")}`);
    let slug = catalogSlug(targetName);
    for (let attempt = 2; (await supabase.from(table).select("id").eq("slug", slug).maybeSingle()).data; attempt++) slug = `${catalogSlug(targetName)}-${attempt}`;
    targetId = crypto.randomUUID();
    const row = kind === "COMPANY"
      ? { id: targetId, slug, name: targetName, sector: group, description: `Conheça a rotina de quem trabalha ou já trabalhou na ${targetName}.`, logoText: targetName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase(), color: "#172033", location: "Brasil", createdAt: now, updatedAt: now }
      : { id: targetId, slug, name: targetName, category: group, description: `Converse com quem atua em ${targetName}.`, accent: "#f2c45d", createdAt: now, updatedAt: now };
    const { error } = await supabase.from(table).insert(row);
    if (error) redirect(`/admin/catalogo?tipo=${tab}&erro=${encodeURIComponent(`Não foi possível criar: ${error.message}`)}`);
  } else if (decision !== "reject") {
    redirect("/admin/catalogo");
  }

  const { data: experiences } = await supabase.from("EmploymentExperience").select(`id, ${pendingColumn}`).eq(idColumn, placeholder).not(pendingColumn, "is", null);
  const waiting = (experiences ?? []).filter((item: Record<string, string>) => catalogKey(item[pendingColumn]) === key).map((item: { id: string }) => item.id);
  if (waiting.length) {
    const update = targetId ? { [idColumn]: targetId, [pendingColumn]: null } : { [pendingColumn]: null };
    const { error } = await supabase.from("EmploymentExperience").update(update).in("id", waiting);
    if (error) redirect(`/admin/catalogo?tipo=${tab}&erro=${encodeURIComponent(`Não foi possível atualizar os perfis: ${error.message}`)}`);
  }
  await supabase.from("CatalogRequest").update({ status: targetId ? "APPROVED" : "REJECTED", resolvedId: targetId, reviewedAt: now }).in("id", requests.map((item: { id: string }) => item.id));

  const noun = kind === "COMPANY" ? "A empresa" : "A área de atuação";
  const placeholderName = kind === "COMPANY" ? "Empresa não cadastrada" : "Área não cadastrada";
  const userIds = [...new Set(requests.map((item: { userId: string }) => item.userId))];
  await supabase.from("Notification").insert(userIds.map((userId) => ({
    id: crypto.randomUUID(), userId, createdAt: now, href: "/consultor/perfil",
    title: targetId ? `${kind === "COMPANY" ? "Empresa" : "Área"} adicionada ao seu perfil` : `${kind === "COMPANY" ? "Empresa" : "Área"} não adicionada`,
    body: targetId ? `${noun} “${targetName}” foi aprovada e já aparece no seu perfil.` : `${noun} “${requests[0].name}” não foi adicionada ao catálogo. Seu perfil continua como “${placeholderName}”; se foi um erro de digitação, corrija em Perfil.`,
  })));
  for (const path of ["/admin/catalogo", "/empresas", "/profissoes", "/buscar", "/consultor/perfil"]) revalidatePath(path);
  revalidatePath("/profissional/[id]", "page");
  redirect(`/admin/catalogo?tipo=${tab}&ok=${targetId ? "aprovado" : "recusado"}`);
}

// Suspension, audited CPF access and the per-user admin view (/admin/usuarios/[id]).
const SUSPENSION_DAYS: Record<string, number | null> = { "7": 7, "30": 30, "90": 90, permanent: null };

export async function suspendUserAction(userId: string, formData: FormData) {
  const admin = await requireUser([Role.ADMIN]); after(() => logAdminAction(admin.id, "suspend", userId, String(formData.get("duration") || "") + ": " + String(formData.get("reason") || "")));
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  const duration = String(formData.get("duration") || "");
  if (reason.length < 10 || !(duration in SUSPENSION_DAYS) || userId === admin.id) redirect(`/admin/usuarios/${userId}?erro=${encodeURIComponent("Informe a duração e um motivo com pelo menos 10 caracteres.")}`);
  const days = SUSPENSION_DAYS[duration];
  const now = new Date();
  // The suspension columns are added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { error } = await supabase.from("User").update({ suspendedAt: now.toISOString(), suspendedUntil: days ? new Date(now.getTime() + days * 86_400_000).toISOString() : null, suspensionReason: reason, updatedAt: now.toISOString() }).eq("id", userId).neq("role", "ADMIN");
  if (error) redirect(`/admin/usuarios/${userId}?erro=${encodeURIComponent(error.message)}`);
  const { data: suspendedUser } = await supabase.from("User").select("email, name").eq("id", userId).maybeSingle();
  if (suspendedUser?.email) await sendSecurityEmail(suspendedUser.email, suspendedUser.name, "suspended", { reason, until: days ? new Date(now.getTime() + days * 86_400_000).toLocaleString("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }) : null }).catch((error) => console.error("suspension_email_failed", { error }));
  // Out of search and booking while suspended; free slots are kept for when it is lifted.
  const { data: profile } = await supabase.from("ProfessionalProfile").update({ isActive: false, updatedAt: now.toISOString() }).eq("userId", userId).select("id").maybeSingle();
  // Conversations already booked with a suspended consultant will not happen: cancel them with a full
  // refund (the customer did nothing wrong; the platform absorbs the card processing fee).
  let cancelled = 0, failed = 0;
  if (profile) {
    const { data: upcoming } = await supabase.from("Booking").select("id").eq("professionalProfileId", profile.id).in("status", ["PENDING_PAYMENT", "CONFIRMED"]).gt("startsAt", now.toISOString()).neq("customerId", userId);
    const notice = "O consultor não está mais disponível na plataforma, por isso a Insidely cancelou a conversa.";
    for (const booking of upcoming ?? []) {
      try {
        const result = await cancelBookingAndRefund({ bookingId: booking.id, consultantId: userId, reason: "Consultor suspenso pela equipe da Insidely.", customerNotice: notice });
        try { await sendBookingCancellationEmail(supabase, booking.id, notice, result.refunded); } catch (error) { console.error("suspension_cancellation_email_failed", { bookingId: booking.id, error }); }
        cancelled++;
      } catch (error) { failed++; console.error("suspension_cancellation_failed", { bookingId: booking.id, error }); }
    }
  }
  revalidatePath("/admin/usuarios"); revalidatePath("/buscar"); revalidatePath("/dashboard/agendamentos"); revalidatePath("/consultor/consultas");
  redirect(`/admin/usuarios/${userId}?ok=suspensa&canceladas=${cancelled}&falhas=${failed}`);
}

export async function liftSuspensionAction(userId: string) {
  const actor = await requireUser([Role.ADMIN]); after(() => logAdminAction(actor.id, "lift_suspension", userId, null));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const now = new Date().toISOString();
  const { data: user } = await supabase.from("User").update({ suspendedAt: null, suspendedUntil: null, suspensionReason: null, updatedAt: now }).eq("id", userId).select("auth_user_id").maybeSingle();
  // A deleted account keeps its profile off; it comes back only if the person reactivates the account.
  if (user?.auth_user_id) await supabase.from("ProfessionalProfile").update({ isActive: true, updatedAt: now }).eq("userId", userId).is("pausedAt", null);
  await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId, title: "Suspensão encerrada", body: "Sua conta voltou a funcionar normalmente.", href: "/continuar", createdAt: now });
  revalidatePath("/admin/usuarios"); revalidatePath("/buscar");
  redirect(`/admin/usuarios/${userId}?ok=liberada`);
}

// The full CPF is only shown right after the admin records why (e.g. a court order number).
export async function revealIdentityAction(userId: string, formData: FormData) {
  const admin = await requireUser([Role.ADMIN]); after(() => logAdminAction(admin.id, "reveal_identity", userId, String(formData.get("reason") || "")));
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  if (reason.length < 15) redirect(`/admin/usuarios/${userId}?erro=${encodeURIComponent("Descreva o motivo do acesso com pelo menos 15 caracteres (ex.: número do ofício ou do processo).")}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createSupabaseServiceClient() as any).from("IdentityAccessAudit").insert({ adminUserId: admin.id, targetUserId: userId, reason }).select("id").single();
  if (error) redirect(`/admin/usuarios/${userId}?erro=${encodeURIComponent("Não foi possível registrar o acesso.")}`);
  redirect(`/admin/usuarios/${userId}?acesso=${data.id}`);
}

// Booking participants: the customer and the consultant behind the profile (service role lookup).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bookingParticipants(supabase: any, bookingId: string) {
  const { data: booking } = await supabase.from("Booking").select("id, status, startsAt, durationMinutes, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (!booking) return null;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
  return profile ? { booking, customerId: booking.customerId as string, consultantId: profile.userId as string } : null;
}

// Report the other side of a conversation, from the chat of either participant.
export async function reportConversationAction(bookingId: string, formData: FormData) {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/dashboard/mensagens");
  const category = String(formData.get("category") || "");
  const description = String(formData.get("description") || "").trim().slice(0, 2000);
  if (!CONVERSATION_REPORT_CATEGORIES.includes(category) || description.length < 20) redirect(`${returnTo}?denuncia=curta`);
  if (!await consumeQuota(`conversation-report:${user.id}`, 5, 3600)) redirect(`${returnTo}?denuncia=limite`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const parties = await bookingParticipants(supabase, bookingId);
  if (!parties || ![parties.customerId, parties.consultantId].includes(user.id) || parties.customerId === parties.consultantId) redirect(`${returnTo}?denuncia=erro`);
  const now = new Date().toISOString();
  const { error } = await supabase.from("Report").insert({ id: crypto.randomUUID(), reporterId: user.id, targetUserId: user.id === parties.customerId ? parties.consultantId : parties.customerId, bookingId, category, description, createdAt: now, updatedAt: now });
  if (error) { console.error("conversation_report_failed", { bookingId, error }); redirect(`${returnTo}?denuncia=erro`); }
  const { data: admins } = await supabase.from("User").select("id").eq("role", "ADMIN");
  if (admins?.length) await supabase.from("Notification").insert(admins.map((admin: { id: string }) => ({ id: crypto.randomUUID(), userId: admin.id, title: "Nova denúncia em conversa", body: category, href: "/admin/denuncias", createdAt: now })));
  revalidatePath("/admin/denuncias");
  if (user.email) await sendSecurityEmail(user.email, user.name, "report_received").catch((error) => console.error("report_email_failed", { error }));
  redirect(`${returnTo}?denuncia=ok`);
}

// Consultants rate the customer (1 to 5 stars) once the conversation's time is over; see customerReputation.
export async function rateCustomerAction(bookingId: string, formData: FormData) {
  const user = await requireUser([Role.CONSULTANT]);
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") || "").trim().slice(0, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) redirect("/consultor/consultas?avaliacao=erro");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const parties = await bookingParticipants(supabase, bookingId);
  if (!parties || parties.consultantId !== user.id || parties.customerId === user.id || !canReviewBooking(parties.booking.status, parseDbDate(parties.booking.startsAt), parties.booking.durationMinutes)) redirect("/consultor/consultas?avaliacao=erro");
  const commentCheck = comment ? moderateChatMessage(comment, { countScatteredDigits: false }) : { allowed: true as const };
  if (!commentCheck.allowed) redirect(`/consultor/consultas?avaliacao=${commentCheck.reason === "offensive" ? "ofensiva" : "contato"}`);
  const { error } = await supabase.from("CustomerFeedback").insert({ bookingId, consultantUserId: user.id, customerId: parties.customerId, rating, comment: comment || null });
  if (error) redirect(`/consultor/consultas?avaliacao=${error.code === "23505" ? "repetida" : "erro"}`);
  revalidatePath("/consultor/consultas");
  redirect("/consultor/consultas?avaliacao=ok");
}

// Called by the open conversation page when a message arrives or the tab comes back into view.
export async function markConversationReadAction(bookingId: string) {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const conversationId = await conversationIdForParticipant(bookingId, user.id);
  if (conversationId) await markConversationRead(conversationId, user.id);
}

// Reviews: anyone signed in can report one the filter missed; admins remove it or keep it.
export async function reportReviewAction(reviewId: string, profileId: string, formData: FormData) {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN], { nextPath: `/profissional/${profileId}` });
  const reason = String(formData.get("reason") || "").trim().slice(0, 1000);
  if (reason.length < 10) redirect(`/profissional/${profileId}?avaliacao=curta`);
  if (!await consumeQuota(`review-report:${user.id}`, 5, 3600)) redirect(`/profissional/${profileId}?avaliacao=limite`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: review } = await supabase.from("Review").select("id, comment, rating, professionalProfileId").eq("id", reviewId).maybeSingle();
  if (!review) redirect(`/profissional/${profileId}`);
  await supabase.from("ReviewReport").insert({ reviewId, reporterId: user.id, reason, reviewComment: review.comment, reviewRating: review.rating, professionalProfileId: review.professionalProfileId });
  const { data: admins } = await supabase.from("User").select("id").eq("role", "ADMIN");
  if (admins?.length) await supabase.from("Notification").insert(admins.map((admin: { id: string }) => ({ id: crypto.randomUUID(), userId: admin.id, title: "Avaliação denunciada", body: reason.slice(0, 140), href: "/admin/denuncias", createdAt: new Date().toISOString() })));
  redirect(`/profissional/${profileId}?avaliacao=denunciada`);
}

export async function resolveReviewReportAction(reportId: string, decision: "REMOVED" | "KEPT") {
  const actor = await requireUser([Role.ADMIN]); after(() => logAdminAction(actor.id, "resolve_review_report", null, `${decision} ${reportId}`));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: report } = await supabase.from("ReviewReport").select("reviewId, professionalProfileId").eq("id", reportId).maybeSingle();
  if (!report) redirect("/admin/denuncias");
  if (decision === "REMOVED" && report.reviewId) await supabase.from("Review").delete().eq("id", report.reviewId);
  // Every open report about the same review is settled by one decision.
  await supabase.from("ReviewReport").update({ status: decision, resolvedAt: new Date().toISOString() }).eq(report.reviewId ? "reviewId" : "id", report.reviewId ?? reportId).eq("status", "OPEN");
  if (report.professionalProfileId) revalidatePath(`/profissional/${report.professionalProfileId}`);
  revalidatePath("/admin/denuncias");
  redirect("/admin/denuncias");
}

// The consultant answers a review publicly, once, under the same rules as the chat.
export async function replyToReviewAction(reviewId: string, profileId: string, formData: FormData) {
  const user = await requireUser([Role.CONSULTANT]);
  const body = String(formData.get("body") || "").trim().slice(0, 1000);
  const check = body ? moderateChatMessage(body, { countScatteredDigits: false }) : { allowed: false as const, reason: "offensive" as const };
  if (body.length < 2) redirect(`/profissional/${profileId}?resposta=curta`);
  if (!check.allowed) redirect(`/profissional/${profileId}?resposta=${check.reason === "offensive" ? "ofensiva" : "contato"}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: review } = await supabase.from("Review").select("professionalProfileId").eq("id", reviewId).maybeSingle();
  const { data: profile } = review ? await supabase.from("ProfessionalProfile").select("id").eq("id", review.professionalProfileId).eq("userId", user.id).maybeSingle() : { data: null };
  if (!profile) redirect(`/profissional/${profileId}`);
  const { error } = await supabase.from("ReviewReply").insert({ reviewId, consultantUserId: user.id, body });
  revalidatePath(`/profissional/${profileId}`);
  redirect(`/profissional/${profileId}?resposta=${error ? "repetida" : "ok"}`);
}

export async function acceptTermsAction(formData: FormData) {
  // Not requireUser: it caches the account state for this request (terms not accepted yet), and the
  // page this action redirects to is rendered in the same request, so it would bounce back here.
  const user = await getAuthenticatedUser();
  if (!user) redirect("/entrar?next=/aceitar-termos");
  if (formData.get("accept") !== "on") redirect("/aceitar-termos");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("User").update({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() }).eq("id", user.id);
  // Absolute URL: the next page loads in a fresh request, with the new terms version.
  redirect(`${getAppUrl()}${safeInternalPath(String(formData.get("next") || ""), "/continuar")}`);
}

// Graduated enforcement: warnings are recorded first; the admin page suggests suspension next.
export async function warnUserAction(userId: string, formData: FormData) {
  const admin = await requireUser([Role.ADMIN]); after(() => logAdminAction(admin.id, "warn", userId, String(formData.get("reason") || "")));
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  if (reason.length < 10) redirect(`/admin/usuarios/${userId}?erro=${encodeURIComponent("Descreva o motivo da advertência com pelo menos 10 caracteres.")}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  await supabase.from("AccountWarning").insert({ userId, adminUserId: admin.id, reason });
  const now = new Date().toISOString();
  await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId, title: "Advertência na sua conta", body: `${reason} Novas ocorrências podem levar à suspensão da conta.`, href: "/termos", createdAt: now });
  const { data: warned } = await supabase.from("User").select("email, name").eq("id", userId).maybeSingle();
  if (warned?.email) await sendSecurityEmail(warned.email, warned.name, "warning", { reason }).catch((error) => console.error("warning_email_failed", { error }));
  revalidatePath(`/admin/usuarios/${userId}`);
  redirect(`/admin/usuarios/${userId}?ok=advertida`);
}

// Either participant of a conversation can block the other: no new bookings between them.
export async function blockUserAction(bookingId: string, formData: FormData) {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/dashboard/mensagens");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const parties = await bookingParticipants(supabase, bookingId);
  if (!parties || ![parties.customerId, parties.consultantId].includes(user.id) || parties.customerId === parties.consultantId) redirect(returnTo);
  const blockedId = user.id === parties.customerId ? parties.consultantId : parties.customerId;
  await supabase.from("UserBlock").upsert({ blockerId: user.id, blockedId }, { onConflict: "blockerId,blockedId", ignoreDuplicates: true });
  revalidatePath("/dashboard/configuracoes");
  redirect(`${returnTo}?bloqueio=ok`);
}

// "Desbloquear" from a conversation: removes the block on the other person and stays on that page.
export async function unblockFromConversationAction(bookingId: string, formData: FormData) {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/dashboard/mensagens");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const parties = await bookingParticipants(supabase, bookingId);
  if (!parties || ![parties.customerId, parties.consultantId].includes(user.id)) redirect(returnTo);
  const blockedId = user.id === parties.customerId ? parties.consultantId : parties.customerId;
  await supabase.from("UserBlock").delete().eq("blockerId", user.id).eq("blockedId", blockedId);
  revalidatePath("/dashboard/configuracoes");
  redirect(`${returnTo}?bloqueio=removido`);
}

export async function unblockUserAction(blockedId: string, consultantContext = false) {
  const user = await requireUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("UserBlock").delete().eq("blockerId", user.id).eq("blockedId", blockedId);
  revalidatePath("/dashboard/configuracoes");
  redirect(`/dashboard/configuracoes?${consultantContext ? "context=consultant&" : ""}bloqueio=removido#bloqueados`);
}

// ---- Agenda: recurring slots, copying a week, pause, "avise-me" ----

const BRASILIA_OFFSET = "-03:00";

// Creates the same weekly slots ("toda terça 19:00") for the next weeks, in Brasília time. Slots that
// overlap something already on the agenda are skipped instead of failing the whole batch.
export async function createRecurringAvailabilityAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const weekdays = formData.getAll("weekday").map(Number).filter((day) => day >= 0 && day <= 6);
  const time = String(formData.get("time") || "");
  const duration = Number(formData.get("duration")) === 60 ? 60 : 30;
  const weeks = Math.min(8, Math.max(1, Number(formData.get("weeks")) || 4));
  if (!weekdays.length || !/^\d{2}:\d{2}$/.test(time)) return { status: "error", message: "Escolha os dias da semana e o horário." };
  const todayInBrasilia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  let created = 0, skipped = 0;
  for (let offset = 0; offset < weeks * 7; offset++) {
    const day = new Date(new Date(`${todayInBrasilia}T12:00:00${BRASILIA_OFFSET}`).getTime() + offset * 86_400_000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(day);
    if (!weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())) continue;
    const startsAt = new Date(`${date}T${time}:00${BRASILIA_OFFSET}`);
    if (startsAt.getTime() <= Date.now() + 10 * 60_000) continue;
    try { await rpc("create_consultant_availability", { p_user_id: user.id, p_starts_at: startsAt.toISOString(), p_ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString() }); created++; }
    catch { skipped++; }
  }
  if (created) after(() => notifyAvailabilityWatchers(user.id).catch((error) => console.error("availability_watch_failed", { error })));
  revalidatePath("/consultor/agenda"); revalidatePath("/buscar");
  return created
    ? { status: "success", message: `${created} ${created === 1 ? "horário criado" : "horários criados"}${skipped ? ` (${skipped} já ocupado${skipped === 1 ? "" : "s"} na agenda, ignorado${skipped === 1 ? "" : "s"})` : ""}.` }
    : { status: "error", message: "Nenhum horário novo: os dias escolhidos já estão ocupados ou já passaram." };
}

// Copies every slot of the next 7 days (free or booked) to the following weeks.
export async function duplicateWeekAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const weeks = Math.min(8, Math.max(1, Number(formData.get("weeks")) || 1));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  if (!profile) return { status: "error", message: "Perfil não encontrado." };
  const now = Date.now();
  const { data: slots } = await supabase.from("Availability").select("startsAt, endsAt").eq("professionalProfileId", profile.id).gte("startsAt", new Date(now).toISOString()).lt("startsAt", new Date(now + 7 * 86_400_000).toISOString());
  if (!slots?.length) return { status: "error", message: "Não há horários nos próximos 7 dias para copiar." };
  let created = 0, skipped = 0;
  for (let week = 1; week <= weeks; week++) for (const slot of slots as { startsAt: string; endsAt: string }[]) {
    const start = parseDbDate(slot.startsAt).getTime() + week * 7 * 86_400_000, end = parseDbDate(slot.endsAt).getTime() + week * 7 * 86_400_000;
    try { await rpc("create_consultant_availability", { p_user_id: user.id, p_starts_at: new Date(start).toISOString(), p_ends_at: new Date(end).toISOString() }); created++; }
    catch { skipped++; }
  }
  if (created) after(() => notifyAvailabilityWatchers(user.id).catch((error) => console.error("availability_watch_failed", { error })));
  revalidatePath("/consultor/agenda"); revalidatePath("/buscar");
  return created
    ? { status: "success", message: `${created} ${created === 1 ? "horário copiado" : "horários copiados"}${skipped ? ` (${skipped} já existia${skipped === 1 ? "" : "m"})` : ""}.` }
    : { status: "error", message: "Esses horários já existem nas próximas semanas." };
}

// Pause: allowed only when no conversation is booked inside the pause; the profile leaves search.
export async function pauseProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const untilRaw = String(formData.get("until") || "");
  const until = untilRaw ? new Date(`${untilRaw}T23:59:59${BRASILIA_OFFSET}`) : null;
  if (until && (Number.isNaN(until.getTime()) || until.getTime() <= Date.now())) return { status: "error", message: "Escolha uma data de volta no futuro." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  if (!profile) return { status: "error", message: "Perfil não encontrado." };
  let query = supabase.from("Booking").select("startsAt").eq("professionalProfileId", profile.id).in("status", ["PENDING_PAYMENT", "CONFIRMED"]).gt("startsAt", new Date().toISOString());
  if (until) query = query.lte("startsAt", until.toISOString());
  const { data: pending } = await query.order("startsAt");
  if (pending?.length) {
    const dates = pending.map((row: { startsAt: string }) => shortDate(parseDbDate(row.startsAt))).join(", ");
    return { status: "error", message: `Antes de pausar, resolva ${pending.length === 1 ? "a conversa marcada" : `as ${pending.length} conversas marcadas`} nesse período (${dates}): faça a conversa ou cancele em Consultas. No cancelamento, o cliente recebe 100% de volta.` };
  }
  const now = new Date().toISOString();
  await supabase.from("ProfessionalProfile").update({ pausedAt: now, pausedUntil: until?.toISOString() ?? null, isActive: false, updatedAt: now }).eq("id", profile.id);
  revalidatePath("/consultor/agenda"); revalidatePath("/buscar");
  return { status: "success", message: until ? `Perfil pausado até ${shortDate(until)}. Ele volta sozinho depois disso.` : "Perfil pausado. Ele volta quando você reativar." };
}

export async function resumeProfileAction() {
  const user = await requireUser([Role.CONSULTANT]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const suspended = Boolean(await getSuspension(user.id));
  await supabase.from("ProfessionalProfile").update({ pausedAt: null, pausedUntil: null, ...(suspended ? {} : { isActive: true }), updatedAt: new Date().toISOString() }).eq("userId", user.id);
  revalidatePath("/consultor/agenda"); revalidatePath("/buscar");
  redirect("/consultor/agenda?pausa=retomada");
}

// "Avise-me quando abrir horário" on a profile without free slots.
export async function toggleAvailabilityWatchAction(profileId: string) {
  const user = await requireUser(undefined, { nextPath: `/profissional/${profileId}` });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: existing } = await supabase.from("AvailabilityWatch").select("userId").eq("userId", user.id).eq("professionalProfileId", profileId).maybeSingle();
  if (existing) await supabase.from("AvailabilityWatch").delete().eq("userId", user.id).eq("professionalProfileId", profileId);
  else await supabase.from("AvailabilityWatch").insert({ userId: user.id, professionalProfileId: profileId });
  revalidatePath(`/profissional/${profileId}`);
}

// New slots: everyone who asked to be warned gets a notification and an e-mail (once, then the
// request ends); people who favorited the profile get a notification at most once a day.
async function notifyAvailabilityWatchers(consultantUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", consultantUserId).maybeSingle();
  if (!profile) return;
  const { data: card } = await supabase.from("public_profile_cards").select("user").eq("id", profile.id).maybeSingle();
  const name = (Array.isArray(card?.user) ? card.user[0]?.name : card?.user?.name) || "Um consultor";
  const href = `/profissional/${profile.id}`;
  const now = new Date().toISOString();
  const { data: watches } = await supabase.from("AvailabilityWatch").select("userId, user:User(email, name)").eq("professionalProfileId", profile.id);
  for (const watch of (watches ?? []) as { userId: string; user: { email: string; name: string } | { email: string; name: string }[] | null }[]) {
    const person = Array.isArray(watch.user) ? watch.user[0] : watch.user;
    await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: watch.userId, title: "Novo horário disponível", body: `${name} abriu horários na agenda.`, href, createdAt: now });
    if (person?.email) await sendTransactionalEmail({ to: person.email, subject: `${name} abriu horários na Insidely`, html: `<p>Olá, ${person.name || ""}!</p><p>Você pediu para ser avisado: <strong>${name}</strong> acabou de abrir horários para conversa.</p><p><a href="${getAppUrl()}${href}">Ver horários disponíveis</a></p>` }).catch(() => undefined);
  }
  if (watches?.length) await supabase.from("AvailabilityWatch").delete().eq("professionalProfileId", profile.id);
  if (!await consumeQuota(`favorite-slots:${profile.id}`, 1, 86_400)) return;
  const { data: favorites } = await supabase.from("Favorite").select("userId").eq("professionalProfileId", profile.id);
  const watched = new Set((watches ?? []).map((watch: { userId: string }) => watch.userId));
  const rows = (favorites ?? []).filter((favorite: { userId: string }) => !watched.has(favorite.userId)).map((favorite: { userId: string }) => ({ id: crypto.randomUUID(), userId: favorite.userId, title: "Novo horário de um favorito", body: `${name} abriu horários na agenda.`, href, createdAt: now }));
  if (rows.length) await supabase.from("Notification").insert(rows);
}

// The consultant's welcome message (posted automatically when a payment is confirmed).
export async function saveWelcomeMessageAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const text = String(formData.get("welcomeMessage") || "").trim().slice(0, 600);
  if (text) {
    const check = moderateChatMessage(text, { countScatteredDigits: false });
    if (!check.allowed) return { status: "error", message: check.reason === "offensive" ? "A mensagem tem palavrões ou ofensas." : "A mensagem não pode ter telefone, e-mail, link ou rede social." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("ProfessionalProfile").update({ welcomeMessage: text || null, updatedAt: new Date().toISOString() }).eq("userId", user.id);
  revalidatePath("/consultor"); revalidatePath("/consultor/perfil");
  return { status: "success", message: text ? "Mensagem de boas-vindas salva. Ela vai para o chat de cada conversa confirmada." : "Mensagem de boas-vindas desativada." };
}

// ---- After the conversation: one-click survey and "Decidi!" stories ----

async function customerBookingForUser(bookingId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const parties = await bookingParticipants(supabase, bookingId);
  if (!parties || parties.customerId !== userId || parties.consultantId === userId) return null;
  if (!canReviewBooking(parties.booking.status, parseDbDate(parties.booking.startsAt), parties.booking.durationMinutes)) return null;
  return { supabase, parties };
}

export async function answerSurveyAction(bookingId: string, answer: "YES" | "PARTLY" | "NO") {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const found = await customerBookingForUser(bookingId, user.id);
  if (found && ["YES", "PARTLY", "NO"].includes(answer)) await found.supabase.from("ConversationSurvey").upsert({ bookingId, customerId: user.id, answer }, { onConflict: "bookingId" });
  revalidatePath("/dashboard/avaliacoes");
}

export async function saveDecisionStoryAction(bookingId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const story = String(formData.get("story") || "").trim().slice(0, 600);
  if (story.length < 20) return { status: "error", message: "Conte em pelo menos 20 caracteres o que você decidiu." };
  const check = moderateChatMessage(story, { countScatteredDigits: false });
  if (!check.allowed) return { status: "error", message: check.reason === "offensive" ? "O texto tem palavrões ou ofensas. Reescreva para enviar." : "O texto não pode ter telefone, e-mail, link ou rede social." };
  const found = await customerBookingForUser(bookingId, user.id);
  if (!found) return { status: "error", message: "Esta conversa não está disponível." };
  const allowPublish = formData.get("allowPublish") === "on";
  await found.supabase.from("DecisionStory").upsert({ bookingId, customerId: user.id, story, allowPublish, status: "PENDING" }, { onConflict: "bookingId" });
  if (allowPublish) {
    const { data: admins } = await found.supabase.from("User").select("id").eq("role", "ADMIN");
    if (admins?.length) await found.supabase.from("Notification").insert(admins.map((admin: { id: string }) => ({ id: crypto.randomUUID(), userId: admin.id, title: "Nova história para aprovar", body: story.slice(0, 120), href: "/admin/historias", createdAt: new Date().toISOString() })));
  }
  return { status: "success", message: allowPublish ? "Obrigado! Sua história vai para análise e pode aparecer no perfil do consultor e na página inicial, sem o seu nome completo." : "Obrigado por contar! Sua história fica só com a equipe da Insidely." };
}

export async function reviewDecisionStoryAction(bookingId: string, decision: "APPROVED" | "REJECTED" | "PENDING") {
  const actor = await requireUser([Role.ADMIN]); after(() => logAdminAction(actor.id, "review_story", null, `${decision} ${bookingId}`));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  await supabase.from("DecisionStory").update({ status: decision }).eq("bookingId", bookingId);
  // A rejected (or reconsidered) story is no longer on the home page.
  if (decision !== "APPROVED") await supabase.from("DecisionStory").update({ featuredAt: null }).eq("bookingId", bookingId).then(() => undefined, () => undefined);
  revalidatePath("/admin/historias"); revalidatePath("/"); revalidatePath("/profissional/[id]", "page");
}

// Up to HOME_STORY_LIMIT approved stories are featured in the home page carousel.
export async function featureDecisionStoryAction(bookingId: string, featured: boolean) {
  const actor = await requireUser([Role.ADMIN]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  if (featured) {
    const { count } = await supabase.from("DecisionStory").select("bookingId", { count: "exact", head: true }).not("featuredAt", "is", null);
    if ((count ?? 0) >= HOME_STORY_LIMIT) redirect("/admin/historias?erro=limite");
  }
  await supabase.from("DecisionStory").update({ featuredAt: featured ? new Date().toISOString() : null }).eq("bookingId", bookingId).eq("status", "APPROVED");
  after(() => logAdminAction(actor.id, "review_story", null, `${featured ? "FEATURE" : "UNFEATURE"} ${bookingId}`));
  revalidatePath("/admin/historias"); revalidatePath("/");
}

// What the consultant tells about the area (aggregated anonymously on the profession page).
export async function saveAreaInsightsAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const salaryRange = String(formData.get("salaryRange") || "") || null;
  const areaPro = String(formData.get("areaPro") || "").trim().slice(0, 200) || null;
  const areaCon = String(formData.get("areaCon") || "").trim().slice(0, 200) || null;
  for (const text of [areaPro, areaCon]) {
    if (!text) continue;
    const check = moderateChatMessage(text, { countScatteredDigits: false });
    if (!check.allowed) return { status: "error", message: check.reason === "offensive" ? "O texto tem palavrões ou ofensas." : "O texto não pode ter telefone, e-mail, link ou rede social." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (createSupabaseServiceClient() as any).from("ProfessionalProfile").update({ salaryRange, areaPro, areaCon, updatedAt: new Date().toISOString() }).eq("userId", user.id);
  if (error) return { status: "error", message: "Não foi possível salvar agora." };
  revalidatePath("/consultor"); revalidatePath("/consultor/perfil"); revalidatePath("/profissao/[slug]", "page");
  return { status: "success", message: "Obrigado! Suas respostas aparecem de forma anônima na página da sua área." };
}

// Internal notes on an account, visible only to admins.
export async function addAdminNoteAction(userId: string, formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const body = String(formData.get("body") || "").trim().slice(0, 2000);
  if (body.length >= 2) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createSupabaseServiceClient() as any).from("AdminNote").insert({ userId, adminUserId: admin.id, body });
    after(() => logAdminAction(admin.id, "note", userId, body.slice(0, 120)));
  }
  revalidatePath(`/admin/usuarios/${userId}`);
  redirect(`/admin/usuarios/${userId}#notas`);
}

// Case queue: an admin takes ownership of a report, a reported review or a dispute.
// Taking a case records who handles it; a case only opens after someone took it. With openHref
// the admin lands on the case right away ("Assumir e abrir").
export async function assignCaseAction(caseKey: string, openHref?: string) {
  const admin = await requireUser([Role.ADMIN]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("CaseAssignment").upsert({ caseKey, adminUserId: admin.id, assignedAt: new Date().toISOString() }, { onConflict: "caseKey" });
  after(() => logAdminAction(admin.id, "take_case", null, caseKey));
  revalidatePath("/admin/casos");
  if (openHref) redirect(safeInternalPath(openHref, "/admin/casos").startsWith("/admin/") ? safeInternalPath(openHref, "/admin/casos") : "/admin/casos");
}

// Web push: a device that allowed notifications.
export async function savePushSubscriptionAction(subscription: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }) {
  const user = await requireUser();
  if (!subscription.endpoint?.startsWith("https://") || !subscription.keys?.p256dh || !subscription.keys.auth) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("PushSubscription").upsert({ endpoint: subscription.endpoint.slice(0, 1000), userId: user.id, p256dh: subscription.keys.p256dh.slice(0, 200), auth: subscription.keys.auth.slice(0, 100) }, { onConflict: "endpoint" });
}

export async function removePushSubscriptionAction(endpoint: string) {
  const user = await requireUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("PushSubscription").delete().eq("endpoint", endpoint).eq("userId", user.id);
}

// Admin removes an account (e.g. fake or abusive). Same effect as the person deleting it: files
// removed, the row anonymized (CPF and history kept for the legal period) and the login deleted.
// Refused while the account has conversations pending, booked or under dispute.
export async function adminDeleteAccountAction(userId: string, formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const back = (message: string) => redirect(`/admin/usuarios/${userId}?erro=${encodeURIComponent(message)}#excluir`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: target } = await supabase.from("User").select("id, email, role, auth_user_id").eq("id", userId).maybeSingle();
  if (!target || target.role === "ADMIN" || !target.auth_user_id) back("Esta conta não pode ser excluída por aqui.");
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  if (String(formData.get("confirmation") || "").trim().toLowerCase() !== String(target.email).toLowerCase()) back("Digite exatamente o e-mail da conta para confirmar.");
  if (reason.length < 10) back("Explique o motivo da exclusão com pelo menos 10 caracteres.");
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", userId).maybeSingle();
  let open = supabase.from("Booking").select("id", { count: "exact", head: true }).in("status", ["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "AWAITING_CONFIRMATION", "DISPUTED"]);
  open = profile ? open.or(`customerId.eq.${userId},professionalProfileId.eq.${profile.id}`) : open.eq("customerId", userId);
  const { count } = await open;
  if (count) back(`A conta tem ${count} conversa(s) pendente(s), marcada(s) ou em análise. Cancele ou resolva antes de excluir (ou suspenda a conta).`);
  for (const [bucket, prefix] of [["avatars", `avatars/${target.auth_user_id}`], ["profile-covers", `covers/${target.auth_user_id}`], ["verification-documents", target.auth_user_id]]) {
    const { data: files } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    const paths = (files ?? []).filter((file: { id: string | null }) => file.id).map((file: { name: string }) => `${prefix}/${file.name}`);
    if (paths.length) await supabase.storage.from(bucket).remove(paths);
  }
  await supabase.from("AccountDeletionAudit").insert({ auth_user_id: target.auth_user_id });
  const { error } = await supabase.from("User").update({ name: "Conta excluída", email: `deleted+${target.auth_user_id}@invalid.insidely`, image: null, auth_user_id: null, onboardingCompleted: false, updatedAt: new Date().toISOString() }).eq("id", userId);
  if (error) back("Não foi possível excluir a conta agora.");
  await supabase.auth.admin.deleteUser(target.auth_user_id);
  after(() => logAdminAction(admin.id, "delete_account", userId, reason));
  revalidatePath("/admin/usuarios"); revalidatePath("/buscar");
  redirect("/admin/usuarios?ok=excluida");
}

// Support cases are threads (ReportMessage). The admin who took the case replies; the reply reaches
// the person in the app (notification → /dashboard/suporte/[id]) and by e-mail. "REPLY" keeps the
// case open waiting for the person; RESOLVED / DISMISSED close it with that last message.
export async function answerReportAction(reportId: string, formData: FormData) {
  const admin = await requireUser([Role.ADMIN]);
  const decision = String(formData.get("decision") || "");
  const reply = String(formData.get("reply") || "").trim();
  const back = `/admin/casos/relato/${reportId}`;
  if (!["REPLY", "RESOLVED", "DISMISSED"].includes(decision)) redirect(`${back}?erro=1`);
  if (reply.length < 10 || reply.length > 4000) redirect(`${back}?erro=resposta`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: owner } = await supabase.from("CaseAssignment").select("adminUserId").eq("caseKey", `report:${reportId}`).maybeSingle();
  if (owner?.adminUserId !== admin.id) redirect(`${back}?erro=responsavel`);
  const now = new Date().toISOString();
  const { data: report } = await supabase.from("Report").update({ status: decision === "REPLY" ? "IN_REVIEW" : decision, ...(decision === "REPLY" ? {} : { resolution: reply }), updatedAt: now }).eq("id", reportId).in("status", ["OPEN", "IN_REVIEW"]).select("reporterId, category").maybeSingle();
  if (!report) redirect(`${back}?erro=fechado`);
  await supabase.from("ReportMessage").insert({ reportId, authorId: admin.id, fromStaff: true, body: reply, createdAt: now });
  if (report.reporterId) {
    const href = `/dashboard/suporte/${reportId}`;
    const title = decision === "REPLY" ? `O suporte respondeu: ${report.category}` : `Caso encerrado pelo suporte: ${report.category}`;
    await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: report.reporterId, title, body: reply.slice(0, 300), href, createdAt: now });
    after(async () => {
      const { data: person } = await supabase.from("User").select("email, name").eq("id", report.reporterId).maybeSingle();
      if (!person?.email) return;
      const safe = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[c] ?? c);
      await sendTransactionalEmail({ to: person.email, subject: title, html: `<p>Olá${person.name ? `, ${safe(person.name.split(" ")[0])}` : ""}!</p><p>O suporte da Insidely respondeu ao seu caso <strong>${safe(report.category)}</strong>:</p><blockquote style="margin:0;padding:12px 16px;border-left:3px solid #ff7657;background:#f6f1e8">${safe(reply).replaceAll("\n", "<br>")}</blockquote><p>${decision === "REPLY" ? "No aplicativo, você pode responder ou marcar o caso como resolvido." : "Se ainda precisar de ajuda, abra um novo pedido no suporte."}</p><p>${emailButton(`${getAppUrl()}${href}`, decision === "REPLY" ? "Ver resposta e responder" : "Ver o caso")}</p>` }).catch((error) => console.error("support_reply_email_failed", { error }));
    });
  }
  after(() => logAdminAction(admin.id, decision === "REPLY" ? "reply_report" : "resolve_report", null, reportId));
  revalidatePath("/admin/casos"); revalidatePath(back); revalidatePath("/admin/suporte"); revalidatePath("/admin/denuncias"); revalidatePath("/admin");
  redirect(decision === "REPLY" ? `${back}?ok=enviada` : `/admin/casos?ok=${decision === "RESOLVED" ? "resolvido" : "arquivado"}`);
}

// The person who opened a case answers the team on the same thread (never a new case), or closes it.
export async function replySupportCaseAction(reportId: string, formData: FormData) {
  const user = await requireUser();
  const body = String(formData.get("body") || "").trim();
  const back = `/dashboard/suporte/${reportId}`;
  if (body.length < 2 || body.length > 4000) redirect(`${back}?erro=curta`);
  if (!await consumeQuota(`support-reply:${user.id}`, 20, 3600)) redirect(`${back}?erro=limite`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const now = new Date().toISOString();
  const { data: report } = await supabase.from("Report").update({ status: "OPEN", updatedAt: now }).eq("id", reportId).eq("reporterId", user.id).in("status", ["OPEN", "IN_REVIEW"]).select("category").maybeSingle();
  if (!report) redirect(`${back}?erro=fechado`);
  await supabase.from("ReportMessage").insert({ reportId, authorId: user.id, fromStaff: false, body, createdAt: now });
  await notifyCaseStaff(supabase, reportId, `Nova resposta no caso: ${report.category}`, body.slice(0, 300), now);
  revalidatePath(back); revalidatePath("/admin/casos");
  redirect(`${back}?ok=enviada`);
}

export async function closeSupportCaseAction(reportId: string) {
  const user = await requireUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const now = new Date().toISOString();
  const { data: report } = await supabase.from("Report").update({ status: "RESOLVED", updatedAt: now }).eq("id", reportId).eq("reporterId", user.id).in("status", ["OPEN", "IN_REVIEW"]).select("category").maybeSingle();
  if (report) await notifyCaseStaff(supabase, reportId, `Caso marcado como resolvido: ${report.category}`, "Quem abriu o caso confirmou que o problema foi resolvido.", now);
  revalidatePath(`/dashboard/suporte/${reportId}`); revalidatePath("/admin/casos");
  redirect(`/dashboard/suporte/${reportId}?ok=resolvido`);
}

// Records which experience the just-submitted proof covers (Verification.experienceId, migration
// 20261101099000). Only an experience of the consultant's own profile is accepted.
async function linkVerificationExperience(formData: FormData) {
  const experienceId = String(formData.get("experienceId") || "");
  if (!experienceId) return;
  const user = await requireUser([Role.CONSULTANT]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  if (!profile) return;
  const { data: experience } = await supabase.from("EmploymentExperience").select("id").eq("id", experienceId).eq("professionalProfileId", profile.id).maybeSingle();
  if (!experience) return;
  await supabase.from("Verification").update({ experienceId }).eq("professionalProfileId", profile.id).eq("status", "PENDING").then(() => undefined, () => undefined);
}

// The admin who took the case is notified; with nobody assigned yet, every admin is.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyCaseStaff(supabase: any, reportId: string, title: string, body: string, createdAt: string) {
  const { data: owner } = await supabase.from("CaseAssignment").select("adminUserId").eq("caseKey", `report:${reportId}`).maybeSingle();
  const { data: admins } = owner ? { data: [{ id: owner.adminUserId }] } : await supabase.from("User").select("id").eq("role", "ADMIN");
  const rows = ((admins ?? []) as { id: string }[]).map((admin) => ({ id: crypto.randomUUID(), userId: admin.id, title, body, href: `/admin/casos/relato/${reportId}`, createdAt }));
  if (rows.length) await supabase.from("Notification").insert(rows);
}
