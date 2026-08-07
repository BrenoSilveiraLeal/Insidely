"use server";

import { hash } from "bcryptjs";
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

export async function registerAction(_: string | undefined, formData: FormData) {
  const parsed = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(["USER", "CONSULTANT"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return "Revise os dados. A senha precisa ter ao menos 8 caracteres.";
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return "Este e-mail já está cadastrado.";
  await prisma.user.create({ data: { name: parsed.data.name, email, passwordHash: await hash(parsed.data.password, 12), role: parsed.data.role as Role } });
  await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/onboarding" });
}

export async function logoutAction() { await signOut({ redirectTo: "/" }); }

export async function completeOnboardingAction(formData: FormData) {
  const user = await requireUser();
  const role = (formData.get("role") === "CONSULTANT" ? Role.CONSULTANT : Role.USER);
  await prisma.user.update({ where: { id: user.id }, data: { role, onboardingCompleted: true } });
  if (role === Role.CONSULTANT) {
    const company = await prisma.company.findFirst(); const profession = await prisma.profession.findFirst();
    if (company && profession) await prisma.professionalProfile.upsert({ where: { userId: user.id }, update: {}, create: {
      userId: user.id, headline: String(formData.get("headline") || "Profissional disponível para conversas de carreira"), bio: String(formData.get("bio") || "Compartilho minha experiência com contexto e responsabilidade."),
      location: String(formData.get("location") || "Brasil"), region: "Brasil", workMode: "REMOTE", seniority: "MID", yearsExperience: 3, price30Cents: 4500, price60Cents: 8000,
      avatarSeed: user.id, topics: ["Rotina real", "Cultura", "Carreira"], boundaries: ["Dados confidenciais", "Dados pessoais"], privacyMode: "PROTECTED",
      privacy: { create: {} }, experiences: { create: { companyId: company.id, professionId: profession.id, title: "Profissional", area: profession.category, isCurrent: true, startedAt: new Date(), summary: "Experiência informada no onboarding." } },
    } });
  }
  redirect(role === Role.CONSULTANT ? "/consultor" : "/dashboard");
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
  const subtotal = duration === 60 ? profile.price60Cents : profile.price30Cents; const fee = Math.round(subtotal * 0.1);
  const booking = await prisma.$transaction(async (tx) => {
    const locked = await tx.availability.updateMany({ where: { id: slot.id, isBooked: false }, data: { isBooked: true } });
    if (!locked.count) throw new Error("Horário já reservado");
    return tx.booking.create({ data: { customerId: user.id, professionalProfileId: profileId, availabilityId: slot.id, startsAt: slot.startsAt, durationMinutes: duration, topics: formData.getAll("topics").map(String), goals: String(formData.get("goals") || ""), subtotalCents: subtotal, feeCents: fee, totalCents: subtotal + fee, conversation: { create: {} }, payment: { create: { amountCents: subtotal + fee } } } });
  });
  redirect(`/checkout/${booking.id}`);
}

export async function payBookingAction(bookingId: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, customerId: user.id, status: BookingStatus.PENDING_PAYMENT } });
  if (!booking) throw new Error("Consulta inválida ou já processada");
  await prisma.$transaction([
    prisma.payment.update({ where: { bookingId }, data: { status: PaymentStatus.APPROVED, paidAt: new Date(), providerRef: `SIM-${Date.now()}` } }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CONFIRMED } }),
    prisma.notification.create({ data: { userId: booking.customerId, title: "Conversa confirmada", body: "Pagamento demonstrativo aprovado. Seu horário está reservado.", href: "/dashboard/agendamentos" } }),
  ]);
  redirect("/dashboard/agendamentos?confirmado=1");
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

export async function submitVerificationAction() {
  const user = await requireUser([Role.CONSULTANT]); const profile = await prisma.professionalProfile.findUnique({ where: { userId: user.id } }); if (!profile) return;
  await prisma.$transaction([prisma.verification.create({ data: { professionalProfileId: profile.id, method: "Autodeclaração + documento (simulado)", status: VerificationStatus.PENDING } }), prisma.professionalProfile.update({ where: { id: profile.id }, data: { verificationStatus: VerificationStatus.PENDING } })]);
  revalidatePath("/consultor/verificacao");
}

export async function reviewVerificationAction(verificationId: string, decision: "VERIFIED" | "REJECTED") {
  const user = await requireUser([Role.ADMIN]); const verification = await prisma.verification.findUnique({ where: { id: verificationId } }); if (!verification) return;
  await prisma.$transaction([prisma.verification.update({ where: { id: verificationId }, data: { status: decision, reviewerId: user.id, reviewedAt: new Date() } }), prisma.professionalProfile.update({ where: { id: verification.professionalProfileId }, data: { verificationStatus: decision } })]);
  revalidatePath("/admin/verificacoes"); revalidatePath("/admin");
}

export async function resolveReportAction(reportId: string) {
  await requireUser([Role.ADMIN]); await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED", resolution: "Analisado pela moderação demonstrativa." } }); revalidatePath("/admin/denuncias");
}
