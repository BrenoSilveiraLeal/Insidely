"use server";

import { hash } from "bcryptjs";
import { put } from "@vercel/blob";
import { BookingStatus, PaymentStatus, Role, VerificationStatus } from "@prisma/client";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function loginAction(_: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return "E-mail ou senha incorretos.";
    throw error;
  }
}

export async function socialSignInAction(provider: "google" | "linkedin") {
  const configured = provider === "google"
    ? Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
    : Boolean(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);
  if (!configured) redirect("/entrar?social=pendente");
  await signIn(provider, { redirectTo: "/continuar" });
}

export async function registerAction(_: string | undefined, formData: FormData) {
  const parsed = z.object({
    name: z.string().trim().min(2, "Informe seu nome."),
    email: z.string().trim().email("Informe um e-mail válido."),
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
    confirmPassword: z.string(),
    role: z.enum(["USER", "CONSULTANT"]),
    terms: z.literal("on"),
  }).refine((data) => data.password === data.confirmPassword, { message: "As senhas não coincidem." }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Revise os campos obrigatórios.";
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return "Este e-mail já está cadastrado.";
  await prisma.user.create({ data: { name: parsed.data.name, email, passwordHash: await hash(parsed.data.password, 12), role: parsed.data.role as Role } });
  await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/onboarding" });
}

export async function logoutAction() { await signOut({ redirectTo: "/" }); }

export async function completeOnboardingAction(_: string | undefined, formData: FormData) {
  const user = await requireUser();
  const role = (formData.get("role") === "CONSULTANT" ? Role.CONSULTANT : Role.USER);
  if (role === Role.USER) {
    await prisma.user.update({ where: { id: user.id }, data: { role, onboardingCompleted: true } });
    redirect("/dashboard");
  }
  const parsed = z.object({
    headline: z.string().trim().min(5, "Informe seu título profissional."),
    location: z.string().trim().min(2, "Informe sua localização."),
    bio: z.string().trim().min(30, "Conte um pouco mais sobre sua experiência (mínimo de 30 caracteres)."),
    companyId: z.string().min(1, "Selecione uma empresa."),
    professionId: z.string().min(1, "Selecione uma profissão."),
    title: z.string().trim().min(2, "Informe seu cargo."),
    yearsExperience: z.coerce.number().int().min(0).max(60),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Preencha os campos profissionais obrigatórios.";
  const [company, profession] = await Promise.all([
    prisma.company.findUnique({ where: { id: parsed.data.companyId } }),
    prisma.profession.findUnique({ where: { id: parsed.data.professionId } }),
  ]);
  if (!company || !profession) return "Empresa ou profissão inválida.";
  await prisma.user.update({ where: { id: user.id }, data: { role, onboardingCompleted: true } });
  if (role === Role.CONSULTANT) {
    await prisma.professionalProfile.upsert({ where: { userId: user.id }, update: {}, create: {
      userId: user.id, headline: parsed.data.headline, bio: parsed.data.bio,
      location: parsed.data.location, region: "Brasil", workMode: "REMOTE", seniority: "MID", yearsExperience: parsed.data.yearsExperience, price30Cents: 4500, price60Cents: 8000,
      avatarSeed: user.id, topics: ["Rotina real", "Cultura", "Carreira"], boundaries: ["Dados confidenciais", "Dados pessoais"], privacyMode: "PROTECTED",
      privacy: { create: {} }, experiences: { create: { companyId: company.id, professionId: profession.id, title: parsed.data.title, area: profession.category, isCurrent: true, startedAt: new Date(), summary: "Experiência informada no onboarding." } },
    } });
  }
  redirect("/consultor");
}

export async function toggleFavoriteAction(profileId: string) {
  const user = await requireUser();
  const current = await prisma.favorite.findUnique({ where: { userId_professionalProfileId: { userId: user.id, professionalProfileId: profileId } } });
  if (current) await prisma.favorite.delete({ where: { id: current.id } });
  else await prisma.favorite.create({ data: { userId: user.id, professionalProfileId: profileId } });
  revalidatePath("/dashboard/favoritos"); revalidatePath(`/profissional/${profileId}`);
}

export async function createBookingAction(profileId: string, formData: FormData) {
  const user = await requireUser([Role.USER, Role.ADMIN]);
  const duration = Number(formData.get("duration")) === 60 ? 60 : 30;
  const profile = await prisma.professionalProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error("Perfil não encontrado");
  const slot = await prisma.availability.findFirst({ where: { id: String(formData.get("slot")), professionalProfileId: profileId, isBooked: false, startsAt: { gt: new Date() } } });
  if (!slot) throw new Error("Este horário não está mais disponível");
  const subtotal = duration === 60 ? profile.price60Cents : profile.price30Cents; const fee = Math.round(subtotal * 0.2);
  const booking = await prisma.$transaction(async (tx) => {
    const locked = await tx.availability.updateMany({ where: { id: slot.id, isBooked: false }, data: { isBooked: true } });
    if (!locked.count) throw new Error("Horário já reservado");
    return tx.booking.create({ data: { customerId: user.id, professionalProfileId: profileId, availabilityId: slot.id, startsAt: slot.startsAt, durationMinutes: duration, topics: formData.getAll("topics").map(String), goals: String(formData.get("goals") || ""), subtotalCents: subtotal, feeCents: fee, totalCents: subtotal, meetingProvider: "GOOGLE_MEET", conversation: { create: {} }, payment: { create: { amountCents: subtotal } } } });
  });
  redirect(`/checkout/${booking.id}`);
}

export async function payBookingAction(bookingId: string, formData: FormData) {
  const user = await requireUser();
  if (formData.get("recordingConsent") !== "on") throw new Error("Confirme as regras de presença e gravação antes de continuar.");
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, customerId: user.id, status: BookingStatus.PENDING_PAYMENT } });
  if (!booking) throw new Error("Consulta inválida ou já processada");
  await prisma.$transaction([
    prisma.payment.update({ where: { bookingId }, data: { status: PaymentStatus.APPROVED, paidAt: new Date(), provider: `SIMULATED_${String(formData.get("paymentMethod") || "PIX").toUpperCase()}`, providerRef: `SIM-${Date.now()}` } }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CONFIRMED, customerRecordingConsent: true } }),
    prisma.notification.create({ data: { userId: booking.customerId, title: "Conversa confirmada", body: "Pagamento demonstrativo aprovado. A sala do Google Meet será liberada 15 minutos antes do horário.", href: "/dashboard/agendamentos" } }),
  ]);
  redirect("/dashboard/agendamentos?confirmado=1");
}

export async function updateConsultantRecordingConsentAction(bookingId: string, formData: FormData) {
  const user = await requireUser([Role.CONSULTANT]);
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, professional: { userId: user.id } } });
  if (!booking) throw new Error("Consulta não encontrada.");
  await prisma.booking.update({ where: { id: booking.id }, data: { consultantRecordingConsent: formData.get("recordingConsent") === "on" } });
  revalidatePath("/consultor/consultas");
}

export async function sendMessageAction(conversationId: string, formData: FormData) {
  const user = await requireUser(); const body = String(formData.get("body") || "").trim(); if (!body) return;
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, booking: { OR: [{ customerId: user.id }, { professional: { userId: user.id } }] } } });
  if (!conversation) throw new Error("Conversa não autorizada");
  await prisma.message.create({ data: { conversationId, senderId: user.id, body } });
  revalidatePath("/dashboard/mensagens"); revalidatePath("/consultor/consultas");
}

export async function updatePrivacyAction(formData: FormData) {
  const user = await requireUser([Role.CONSULTANT]);
  const profile = await prisma.professionalProfile.findUnique({ where: { userId: user.id } }); if (!profile) return;
  const check = (name: string) => formData.get(name) === "on";
  await prisma.privacySettings.upsert({ where: { professionalProfileId: profile.id }, create: { professionalProfileId: profile.id, showRealName: check("showRealName"), showSurname: check("showSurname"), showPhoto: check("showPhoto"), showCurrentCompany: check("showCurrentCompany"), showCity: check("showCity"), showExactDates: check("showExactDates"), showFullHistory: check("showFullHistory"), searchableByCompany: check("searchableByCompany"), searchableByProfession: check("searchableByProfession") }, update: { showRealName: check("showRealName"), showSurname: check("showSurname"), showPhoto: check("showPhoto"), showCurrentCompany: check("showCurrentCompany"), showCity: check("showCity"), showExactDates: check("showExactDates"), showFullHistory: check("showFullHistory"), searchableByCompany: check("searchableByCompany"), searchableByProfession: check("searchableByProfession") } });
  revalidatePath("/consultor/privacidade");
}

export async function submitVerificationAction(_: string | undefined, formData: FormData) {
  const user = await requireUser([Role.CONSULTANT]); const profile = await prisma.professionalProfile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.verificationStatus === VerificationStatus.PENDING || profile.verificationStatus === VerificationStatus.VERIFIED) return "Esta solicitação não pode ser enviada agora.";
  const document = formData.get("document");
  if (!(document instanceof File) || document.size === 0) return "Anexe um comprovante antes de enviar.";
  if (document.size > 5 * 1024 * 1024) return "O arquivo deve ter no máximo 5 MB.";
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(document.type)) return "Envie um arquivo PDF, JPG, PNG ou WEBP.";
  if (!process.env.BLOB_READ_WRITE_TOKEN) return "O armazenamento privado ainda não foi conectado na Vercel.";
  const methods: Record<string, string> = { company_email: "E-mail corporativo", employment_document: "Documento de vínculo profissional", professional_reference: "Referência profissional verificável" };
  const method = methods[String(formData.get("method") || "")] ?? methods.company_email;
  const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = await put(`verificacoes/${profile.id}/${Date.now()}-${safeName}`, document, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  await prisma.$transaction(async (tx) => {
    const verification = await tx.verification.create({ data: { professionalProfileId: profile.id, method, status: VerificationStatus.PENDING } });
    await tx.verificationDocument.create({ data: { verificationId: verification.id, originalName: document.name, mimeType: document.type, sizeBytes: document.size, storageKey: blob.pathname } });
    await tx.professionalProfile.update({ where: { id: profile.id }, data: { verificationStatus: VerificationStatus.PENDING } });
  });
  revalidatePath("/consultor/perfil"); revalidatePath("/consultor/verificacao");
  return "Solicitação enviada com segurança.";
}

export async function updateProfileImageAction(_: string | undefined, formData: FormData) {
  const user = await requireUser(); const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) return "Escolha uma foto.";
  if (!image.type.startsWith("image/") || image.size > 3 * 1024 * 1024) return "Use uma imagem de até 3 MB.";
  if (!process.env.BLOB_READ_WRITE_TOKEN) return "O armazenamento de fotos ainda não foi conectado na Vercel.";
  const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = await put(`avatars/${user.id}/${Date.now()}-${safeName}`, image, { access: "public", token: process.env.BLOB_READ_WRITE_TOKEN });
  await prisma.user.update({ where: { id: user.id }, data: { image: blob.url } });
  revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor/perfil"); revalidatePath("/buscar");
  return "Foto atualizada.";
}

export async function deleteAccountAction(formData: FormData) {
  const user = await requireUser(); const confirmation = String(formData.get("confirmation") || "").trim().toLowerCase();
  if (confirmation !== String(user.email || "").toLowerCase()) return;
  const profile = await prisma.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    await tx.booking.deleteMany({ where: { OR: [{ customerId: user.id }, ...(profile ? [{ professionalProfileId: profile.id }] : [])] } });
    await tx.user.delete({ where: { id: user.id } });
  });
  await signOut({ redirectTo: "/?conta=excluida" });
}

export async function submitSupportAction(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ category: z.string().trim().min(2), description: z.string().trim().min(20).max(2000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/suporte?erro=1");
  await prisma.report.create({ data: { reporterId: user.id, category: `SUPORTE: ${parsed.data.category}`, description: parsed.data.description } });
  redirect("/suporte?enviado=1");
}

export async function reviewVerificationAction(verificationId: string, decision: "VERIFIED" | "REJECTED") {
  const user = await requireUser([Role.ADMIN]); const verification = await prisma.verification.findUnique({ where: { id: verificationId } }); if (!verification) return;
  await prisma.$transaction([prisma.verification.update({ where: { id: verificationId }, data: { status: decision, reviewerId: user.id, reviewedAt: new Date() } }), prisma.professionalProfile.update({ where: { id: verification.professionalProfileId }, data: { verificationStatus: decision } })]);
  revalidatePath("/admin/verificacoes"); revalidatePath("/admin");
}

export async function resolveReportAction(reportId: string) {
  await requireUser([Role.ADMIN]); await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED", resolution: "Analisado pela moderação demonstrativa." } }); revalidatePath("/admin/denuncias");
}
