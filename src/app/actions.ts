"use server";

import { compare, hash } from "bcryptjs";
import { put } from "@vercel/blob";
import { BookingStatus, PaymentStatus, Role, Seniority, VerificationStatus, WorkMode } from "@prisma/client";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SOCIAL_SESSION_COOKIE } from "@/lib/social-session";
import { requireUser } from "@/lib/session";
import { createRecoveryCodes, createTwoFactorSetup, decryptTwoFactorSecret, encryptTwoFactorSecret, hashRecoveryCode, verifyTotp } from "@/lib/two-factor";

const accountSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").regex(/[a-z]/, "Use ao menos uma letra minúscula na senha.").regex(/[A-Z]/, "Use ao menos uma letra maiúscula na senha.").regex(/[0-9]/, "Use ao menos um número na senha."),
  confirmPassword: z.string(),
  role: z.enum(["USER", "CONSULTANT"]),
  terms: z.literal("on", { error: "Você precisa aceitar os termos para criar sua conta." }),
}).refine((data) => data.password === data.confirmPassword, { message: "As senhas não coincidem.", path: ["confirmPassword"] });

const externalContactPattern = /(?:https?:\/\/|www\.|(?:\+?\d[\d\s().-]{7,}\d)|\b[\w.+-]+@[\w-]+\.[\w.-]+\b)/i;
function hasExternalContact(...values: string[]) { return values.some((value) => externalContactPattern.test(value)); }

const TWO_FACTOR_REQUIRED_FLAG = "__TWO_FACTOR_REQUIRED__";

export async function loginAction(_: string | undefined, formData: FormData) {
  const credentials = z.object({ email: z.string().trim().email("Informe seu e-mail."), password: z.string().min(1, "Informe sua senha."), twoFactorCode: z.string().trim().optional() }).safeParse(Object.fromEntries(formData));
  if (!credentials.success) return credentials.error.issues[0]?.message ?? "Informe e-mail e senha.";
  const email = credentials.data.email.toLowerCase();

  // When the password is correct and 2FA is enabled, ask for code in a second step.
  if (!credentials.data.twoFactorCode) {
    const user = await prisma.user.findUnique({ where: { email }, select: { passwordHash: true, twoFactorEnabled: true, lockedUntil: true } });
    if (user?.passwordHash && (!user.lockedUntil || user.lockedUntil <= new Date())) {
      const passwordOk = await compare(credentials.data.password, user.passwordHash);
      if (passwordOk && user.twoFactorEnabled) return TWO_FACTOR_REQUIRED_FLAG;
    }
  }

  try {
    await signIn("credentials", { email, password: credentials.data.password, twoFactorCode: credentials.data.twoFactorCode, redirectTo: "/continuar" });
  } catch (error) {
    if (error instanceof AuthError) return "E-mail ou senha incorretos.";
    throw error;
  }
}

export async function socialSignInAction(provider: "google" | "linkedin") {
  if (provider === "google") {
    redirect("/auth/google?next=/continuar");
  }
  const configured = Boolean(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);
  if (!configured) redirect("/entrar?social=pendente");
  await signIn(provider, { redirectTo: "/continuar" });
}

export async function registerAction(_: string | undefined, formData: FormData) {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Revise os campos obrigatórios.";
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return "Este e-mail já está cadastrado.";
  await prisma.user.create({ data: { name: parsed.data.name, email, passwordHash: await hash(parsed.data.password, 12), role: parsed.data.role as Role } });
  await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/onboarding" });
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SOCIAL_SESSION_COOKIE);
  await signOut({ redirectTo: "/" });
}

export async function completeOnboardingAction(_: string | undefined, formData: FormData) {
  const user = await requireUser(undefined, { allowIncomplete: true });
  const role = (formData.get("role") === "CONSULTANT" ? Role.CONSULTANT : Role.USER);
  if (formData.get("terms") !== "on") return "Você precisa aceitar os termos da plataforma para concluir o cadastro.";
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
  if (hasExternalContact(parsed.data.headline, parsed.data.bio, parsed.data.title)) return "Não inclua e-mail, telefone, link ou contato externo no perfil profissional.";
  const [company, profession] = await Promise.all([
    prisma.company.findUnique({ where: { id: parsed.data.companyId } }),
    prisma.profession.findUnique({ where: { id: parsed.data.professionId } }),
  ]);
  if (!company || !profession) return "Empresa ou profissão inválida.";
  if (role === Role.CONSULTANT) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { role, onboardingCompleted: true } });
      await tx.professionalProfile.upsert({ where: { userId: user.id }, update: {}, create: {
      userId: user.id, headline: parsed.data.headline, bio: parsed.data.bio,
      location: parsed.data.location, region: "Brasil", workMode: "REMOTE", seniority: "MID", yearsExperience: parsed.data.yearsExperience, price30Cents: 4500, price60Cents: 8000,
      avatarSeed: user.id, topics: ["Rotina real", "Cultura", "Carreira"], boundaries: ["Dados confidenciais", "Dados pessoais"], privacyMode: "PROTECTED",
      privacy: { create: {} }, experiences: { create: { companyId: company.id, professionId: profession.id, title: parsed.data.title, area: profession.category, isCurrent: true, startedAt: new Date(), summary: "Experiência informada no onboarding." } },
      } });
    });
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
  if (slot.endsAt.getTime() - slot.startsAt.getTime() < duration * 60_000) throw new Error("Este horário não comporta a duração escolhida.");
  const subtotal = duration === 60 ? profile.price60Cents : profile.price30Cents; const fee = Math.round(subtotal * 0.2);
  const booking = await prisma.$transaction(async (tx) => {
    const locked = await tx.availability.updateMany({ where: { id: slot.id, isBooked: false }, data: { isBooked: true } });
    if (!locked.count) throw new Error("Horário já reservado");
    return tx.booking.create({ data: { customerId: user.id, professionalProfileId: profileId, availabilityId: slot.id, startsAt: slot.startsAt, durationMinutes: duration, topics: formData.getAll("topics").map(String), goals: String(formData.get("goals") || ""), subtotalCents: subtotal, feeCents: fee, totalCents: subtotal, meetingProvider: "GOOGLE_MEET", conversation: { create: {} }, payment: { create: { amountCents: subtotal } } } });
  });
  redirect(`/checkout/${booking.id}`);
}

type FormState = { status: "success" | "error"; message: string } | undefined;

function localDateToUtc(value: string, offsetMinutes: number) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) + offsetMinutes * 60_000);
}

export async function createAvailabilityAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.CONSULTANT]);
  const parsed = z.object({ startsAt: z.string().min(16), timezoneOffset: z.coerce.number().int().min(-840).max(840), duration: z.coerce.number().int().min(15).max(120).refine((value) => value % 15 === 0) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Escolha uma data, horário e duração válidos." };
  const startsAt = localDateToUtc(parsed.data.startsAt, parsed.data.timezoneOffset); if (!startsAt || startsAt.getTime() < Date.now() + 15 * 60_000) return { status: "error", message: "Escolha um horário com pelo menos 15 minutos de antecedência." };
  const endsAt = new Date(startsAt.getTime() + parsed.data.duration * 60_000);
  const profile = await prisma.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }); if (!profile) return { status: "error", message: "Perfil profissional não encontrado." };
  const conflict = await prisma.availability.findFirst({ where: { professionalProfileId: profile.id, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
  if (conflict) return { status: "error", message: "Você já possui um horário que se sobrepõe a este período." };
  await prisma.availability.create({ data: { professionalProfileId: profile.id, startsAt, endsAt } });
  revalidatePath("/consultor/agenda"); revalidatePath(`/profissional/${profile.id}`); revalidatePath("/buscar");
  return { status: "success", message: "Horário adicionado à sua agenda." };
}

export async function removeAvailabilityAction(availabilityId: string) {
  const user = await requireUser([Role.CONSULTANT]);
  const slot = await prisma.availability.findFirst({ where: { id: availabilityId, professionalProfile: { userId: user.id }, isBooked: false, startsAt: { gt: new Date() } }, select: { id: true, professionalProfileId: true } });
  if (!slot) throw new Error("Somente horários futuros e ainda livres podem ser removidos.");
  await prisma.availability.delete({ where: { id: slot.id } }); revalidatePath("/consultor/agenda"); revalidatePath(`/profissional/${slot.professionalProfileId}`); revalidatePath("/buscar");
}

async function releaseBooking(bookingId: string, automatic = false) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { professional: { select: { userId: true } }, payment: true } });
  if (!booking || booking.status === BookingStatus.DISPUTED || booking.payment?.status !== PaymentStatus.HELD) return false;
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.COMPLETED, meetingEndedAt: booking.meetingEndedAt ?? new Date() } }),
    prisma.payment.update({ where: { bookingId }, data: { status: PaymentStatus.RELEASED, releasedAt: new Date() } }),
    prisma.notification.create({ data: { userId: booking.professional.userId, title: "Repasse liberado", body: automatic ? "O prazo de confirmação terminou sem contestação. O repasse demonstrativo foi liberado." : "Os dois lados confirmaram a conversa. O repasse demonstrativo foi liberado.", href: "/consultor/ganhos" } }),
    prisma.notification.create({ data: { userId: booking.customerId, title: "Conversa concluída", body: automatic ? "O prazo de confirmação terminou sem contestação." : "Os dois lados confirmaram que a conversa aconteceu.", href: "/dashboard/avaliacoes" } }),
  ]);
  return true;
}

export async function releaseEligibleBookings() {
  const bookings = await prisma.booking.findMany({ where: { status: BookingStatus.AWAITING_CONFIRMATION, startsAt: { lt: new Date() }, disputedAt: null, payment: { status: PaymentStatus.HELD } }, select: { id: true, startsAt: true, durationMinutes: true, autoReleaseAt: true } });
  const now = Date.now();
  await Promise.all(bookings.filter((booking) => (booking.autoReleaseAt?.getTime() ?? booking.startsAt.getTime() + (booking.durationMinutes + 24 * 60) * 60_000) <= now).map((booking) => releaseBooking(booking.id, true)));
}

export async function completeBookingAction(bookingId: string) {
  const user = await requireUser([Role.CONSULTANT]);
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, status: BookingStatus.CONFIRMED, professional: { userId: user.id } }, select: { id: true, customerId: true, startsAt: true, durationMinutes: true } });
  if (!booking || new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000) > new Date()) throw new Error("A conversa só pode ser concluída após o horário agendado.");
  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.AWAITING_CONFIRMATION, meetingEndedAt: new Date(), autoReleaseAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }),
    prisma.notification.create({ data: { userId: booking.customerId, title: "Confirme sua conversa", body: "A outra pessoa informou que a conversa terminou. Confirme ou reporte um problema em até 24 horas.", href: "/dashboard/agendamentos" } }),
    prisma.notification.create({ data: { userId: user.id, title: "Confirme sua conversa", body: "Confirme também a realização da conversa para liberar o repasse demonstrativo mais rápido.", href: "/consultor/consultas" } }),
  ]);
  revalidatePath("/consultor/consultas"); revalidatePath("/dashboard/avaliacoes"); revalidatePath("/dashboard/agendamentos");
}

export async function confirmConversationAction(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, status: BookingStatus.AWAITING_CONFIRMATION, OR: [{ customerId: user.id }, { professional: { userId: user.id } }] }, include: { professional: { select: { userId: true } } } });
  if (!booking) throw new Error("Esta conversa não está aguardando sua confirmação.");
  const isConsultant = booking.professional.userId === user.id;
  const updated = await prisma.booking.update({ where: { id: booking.id }, data: isConsultant ? { consultantConfirmedAt: new Date() } : { customerConfirmedAt: new Date() } });
  if ((isConsultant ? updated.customerConfirmedAt : updated.consultantConfirmedAt)) await releaseBooking(booking.id);
  revalidatePath("/dashboard/agendamentos"); revalidatePath("/dashboard/avaliacoes"); revalidatePath("/consultor/consultas"); revalidatePath("/consultor/ganhos");
}

export async function disputeBookingAction(bookingId: string, formData: FormData) {
  const user = await requireUser();
  const description = String(formData.get("description") || "").trim();
  if (description.length < 20 || description.length > 2000) throw new Error("Explique o problema em pelo menos 20 caracteres.");
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, status: { in: [BookingStatus.CONFIRMED, BookingStatus.AWAITING_CONFIRMATION] }, OR: [{ customerId: user.id }, { professional: { userId: user.id } }] }, include: { professional: { select: { userId: true } } } });
  if (!booking) throw new Error("Não foi possível abrir uma contestação para esta conversa.");
  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.DISPUTED, disputedAt: new Date() } }),
    prisma.payment.update({ where: { bookingId: booking.id }, data: { status: PaymentStatus.DISPUTED } }),
    prisma.report.create({ data: { reporterId: user.id, targetUserId: booking.professional.userId === user.id ? booking.customerId : booking.professional.userId, bookingId: booking.id, category: "CONTESTAÇÃO DE CONVERSA", description } }),
    prisma.notification.create({ data: { userId: booking.customerId, title: "Pagamento em análise", body: "A conversa foi contestada. O valor permanece retido até a análise do suporte.", href: "/suporte" } }),
    prisma.notification.create({ data: { userId: booking.professional.userId, title: "Pagamento em análise", body: "A conversa foi contestada. O valor permanece retido até a análise do suporte.", href: "/suporte" } }),
  ]);
  revalidatePath("/dashboard/agendamentos"); revalidatePath("/consultor/consultas"); revalidatePath("/consultor/ganhos");
}

export async function submitReviewAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser([Role.USER, Role.ADMIN]);
  const parsed = z.object({ bookingId: z.string().min(1), rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().min(12, "Escreva ao menos 12 caracteres.").max(800) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise sua avaliação." };
  const booking = await prisma.booking.findFirst({ where: { id: parsed.data.bookingId, customerId: user.id, status: BookingStatus.COMPLETED, review: null }, select: { id: true, professionalProfileId: true } });
  if (!booking) return { status: "error", message: "Só é possível avaliar uma conversa concluída por você, uma única vez." };
  await prisma.review.create({ data: { bookingId: booking.id, userId: user.id, professionalProfileId: booking.professionalProfileId, rating: parsed.data.rating, clarity: parsed.data.rating, usefulness: parsed.data.rating, contextualization: parsed.data.rating, comment: parsed.data.comment } });
  revalidatePath("/dashboard/avaliacoes"); revalidatePath(`/profissional/${booking.professionalProfileId}`); revalidatePath("/buscar");
  return { status: "success", message: "Avaliação publicada. Obrigado por contribuir com a comunidade." };
}

export async function payBookingAction(bookingId: string, formData: FormData) {
  const user = await requireUser();
  if (formData.get("recordingConsent") !== "on") throw new Error("Confirme as regras de presença e gravação antes de continuar.");
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, customerId: user.id, status: BookingStatus.PENDING_PAYMENT }, include: { professional: { select: { userId: true } } } });
  if (!booking) throw new Error("Consulta inválida ou já processada");
  await prisma.$transaction([
    prisma.payment.update({ where: { bookingId }, data: { status: PaymentStatus.HELD, paidAt: new Date(), provider: `SIMULATED_PLATFORM_HOLD_${String(formData.get("paymentMethod") || "PIX").toUpperCase()}`, providerRef: `HOLD-${Date.now()}` } }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CONFIRMED, customerRecordingConsent: true } }),
    prisma.notification.create({ data: { userId: booking.customerId, title: "Pagamento retido com segurança", body: "O valor ficará retido até a conversa ser confirmada. A sala do Google Meet será liberada antes do horário.", href: "/dashboard/agendamentos" } }),
    prisma.notification.create({ data: { userId: booking.professional.userId, title: "Nova conversa confirmada", body: "O pagamento está retido pela plataforma e será liberado após a confirmação da conversa.", href: "/consultor/consultas" } }),
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

export async function updateProfessionalProfileAction(_: string | undefined, formData: FormData) {
  const user = await requireUser([Role.CONSULTANT]);
  const parsed = z.object({
    headline: z.string().trim().min(5, "Informe um título profissional mais completo."),
    bio: z.string().trim().min(30, "A apresentação precisa ter ao menos 30 caracteres."),
    location: z.string().trim().min(2, "Informe sua cidade ou região."),
    region: z.string().trim().min(2, "Informe o país ou região."),
    workMode: z.nativeEnum(WorkMode),
    seniority: z.nativeEnum(Seniority),
    yearsExperience: z.coerce.number().int().min(0).max(60),
    price30Cents: z.coerce.number().int().min(1000, "O valor mínimo da conversa é R$ 10.").max(50000),
    price60Cents: z.coerce.number().int().min(1000, "O valor mínimo da conversa é R$ 10.").max(100000),
    responseHours: z.coerce.number().int().min(1).max(168),
    companyId: z.string().min(1, "Selecione a empresa ou experiência principal."),
    professionId: z.string().min(1, "Selecione sua área de atuação."),
    title: z.string().trim().min(2, "Informe seu cargo."),
    topics: z.string().trim().min(2, "Informe pelo menos um tema de conversa."),
    boundaries: z.string().trim().min(2, "Informe pelo menos um limite da conversa."),
    pixKey: z.string().trim().max(100, "A chave Pix parece longa demais.").optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Revise as informações do seu perfil.";
  if (hasExternalContact(parsed.data.headline, parsed.data.bio, parsed.data.title, parsed.data.topics, parsed.data.boundaries)) return "Não inclua e-mail, telefone, link ou contato externo no perfil profissional.";
  const [profile, company, profession] = await Promise.all([
    prisma.professionalProfile.findUnique({ where: { userId: user.id }, include: { experiences: { where: { isCurrent: true }, take: 1 } } }),
    prisma.company.findUnique({ where: { id: parsed.data.companyId } }),
    prisma.profession.findUnique({ where: { id: parsed.data.professionId } }),
  ]);
  if (!profile || !company || !profession) return "Não foi possível validar a empresa ou a área escolhida.";
  const list = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 8);
  const topics = list(parsed.data.topics); const boundaries = list(parsed.data.boundaries);
  if (!topics.length || !boundaries.length) return "Separe os itens por vírgula e informe pelo menos um de cada tipo.";
  await prisma.$transaction(async (tx) => {
    await tx.professionalProfile.update({ where: { id: profile.id }, data: {
      headline: parsed.data.headline, bio: parsed.data.bio, location: parsed.data.location, region: parsed.data.region,
      workMode: parsed.data.workMode, seniority: parsed.data.seniority, yearsExperience: parsed.data.yearsExperience,
      price30Cents: parsed.data.price30Cents, price60Cents: parsed.data.price60Cents, responseHours: parsed.data.responseHours, topics, boundaries, pixKey: parsed.data.pixKey || null,
    } });
    const current = profile.experiences[0];
    const experienceData = { companyId: company.id, professionId: profession.id, title: parsed.data.title, area: profession.category, isCurrent: true, summary: "Experiência atualizada pelo consultor." };
    if (current) await tx.employmentExperience.update({ where: { id: current.id }, data: experienceData });
    else await tx.employmentExperience.create({ data: { professionalProfileId: profile.id, ...experienceData, startedAt: new Date() } });
  });
  revalidatePath("/consultor"); revalidatePath("/consultor/perfil"); revalidatePath(`/profissional/${profile.id}`); revalidatePath("/buscar");
  return "Perfil profissional atualizado.";
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

type TwoFactorState = { status: "success" | "error"; message: string; recoveryCodes?: string[] } | undefined;

export async function getOrCreateTwoFactorSetup() {
  const user = await requireUser();
  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, twoFactorEnabled: true, twoFactorSetupSecret: true, twoFactorSetupExpiresAt: true } });
  if (!stored || stored.twoFactorEnabled) return null;
  if (stored.twoFactorSetupSecret && stored.twoFactorSetupExpiresAt && stored.twoFactorSetupExpiresAt > new Date()) return { uri: decryptTwoFactorSecret(stored.twoFactorSetupSecret) };
  const setup = createTwoFactorSetup(stored.email);
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSetupSecret: encryptTwoFactorSecret(setup.uri), twoFactorSetupExpiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  return { uri: setup.uri };
}

export async function enableTwoFactorAction(_: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const user = await requireUser(); const code = String(formData.get("code") || "");
  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorSetupSecret: true, twoFactorSetupExpiresAt: true } });
  if (!stored?.twoFactorSetupSecret || !stored.twoFactorSetupExpiresAt || stored.twoFactorSetupExpiresAt < new Date()) return { status: "error", message: "Este QR Code expirou. Atualize a página e tente novamente." };
  let uri = ""; try { uri = decryptTwoFactorSecret(stored.twoFactorSetupSecret); } catch { return { status: "error", message: "Não foi possível validar a configuração de segurança." }; }
  const secret = new URL(uri).searchParams.get("secret");
  if (!secret || !verifyTotp(secret, code)) return { status: "error", message: "Código inválido ou expirado. Confira o Authenticator e tente de novo." };
  const recoveryCodes = createRecoveryCodes();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorSecret: encryptTwoFactorSecret(secret), twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode), twoFactorSetupSecret: null, twoFactorSetupExpiresAt: null } });
  revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor/perfil");
  return { status: "success", message: "Proteção ativada.", recoveryCodes };
}

export async function disableTwoFactorAction(_: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const user = await requireUser(); const code = String(formData.get("code") || "");
  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorSecret: true } });
  try { if (!stored?.twoFactorSecret || !verifyTotp(decryptTwoFactorSecret(stored.twoFactorSecret), code)) return { status: "error", message: "Informe o código atual do Authenticator para desativar a proteção." }; } catch { return { status: "error", message: "Não foi possível validar o código de segurança." }; }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [], twoFactorSetupSecret: null, twoFactorSetupExpiresAt: null } });
  revalidatePath("/dashboard/configuracoes"); revalidatePath("/consultor/perfil"); return { status: "success", message: "Proteção desativada." };
}
