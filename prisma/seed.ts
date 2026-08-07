import { PrismaClient, BookingStatus, PaymentStatus, Role, VerificationStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { companySeed, generateProfessionals, professionSeed } from "./seed-data";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo@123";

async function clearDatabase() {
  await prisma.$transaction([
    prisma.notification.deleteMany(), prisma.profileView.deleteMany(), prisma.message.deleteMany(),
    prisma.conversation.deleteMany(), prisma.report.deleteMany(), prisma.review.deleteMany(),
    prisma.payment.deleteMany(), prisma.booking.deleteMany(), prisma.favorite.deleteMany(),
    prisma.availability.deleteMany(), prisma.verificationDocument.deleteMany(), prisma.verification.deleteMany(),
    prisma.employmentExperience.deleteMany(), prisma.privacySettings.deleteMany(), prisma.professionalProfile.deleteMany(),
    prisma.realityCheck.deleteMany(), prisma.profession.deleteMany(), prisma.company.deleteMany(),
    prisma.session.deleteMany(), prisma.account.deleteMany(), prisma.user.deleteMany(),
  ]);
}

async function main() {
  await clearDatabase();
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  await prisma.company.createMany({
    data: companySeed.map(([slug, name, sector, description, logoText, color, location]) => ({ slug, name, sector, description, logoText, color, location })),
  });
  await prisma.profession.createMany({
    data: professionSeed.map(([slug, name, category, description, accent]) => ({ slug, name, category, description, accent })),
  });

  const [companies, professions] = await Promise.all([prisma.company.findMany(), prisma.profession.findMany()]);
  const companyBySlug = new Map(companies.map((item) => [item.slug, item]));
  const professionBySlug = new Map(professions.map((item) => [item.slug, item]));

  const customer = await prisma.user.create({
    data: { name: "Breno Demo", email: "demo@insidely.com", passwordHash, role: Role.USER, onboardingCompleted: true },
  });
  await prisma.user.create({
    data: { name: "Administrador Insidely", email: "admin@insidely.com", passwordHash, role: Role.ADMIN, onboardingCompleted: true },
  });

  const generated = generateProfessionals(80);
  const createdProfiles: { id: string; userId: string; index: number }[] = [];
  for (const person of generated) {
    const company = companyBySlug.get(person.companySlug);
    const profession = professionBySlug.get(person.professionSlug);
    if (!company || !profession) throw new Error("Catálogo inconsistente durante o seed");
    const startedAt = new Date();
    startedAt.setFullYear(startedAt.getFullYear() - person.yearsExperience);
    const user = await prisma.user.create({
      data: {
        name: person.name,
        email: person.email,
        passwordHash,
        role: Role.CONSULTANT,
        onboardingCompleted: true,
        professionalProfile: {
          create: {
            headline: `${person.title} com experiência em ${company.name}`,
            bio: `Compartilho uma visão contextualizada sobre rotina, colaboração, desenvolvimento e decisões de carreira em ${person.area.toLocaleLowerCase("pt-BR")}. Sem expor pessoas, documentos ou informações confidenciais.`,
            location: person.location,
            region: person.region,
            workMode: person.workMode,
            seniority: person.seniority,
            yearsExperience: person.yearsExperience,
            price30Cents: 3500 + (person.index % 7) * 500,
            price60Cents: 6500 + (person.index % 7) * 800,
            responseHours: 2 + (person.index % 12),
            privacyMode: person.privacyMode,
            pseudonym: person.pseudonym,
            avatarSeed: `${person.name}-${person.index}`,
            topics: ["Rotina real", "Cultura da equipe", "Processo seletivo", "Crescimento", "Carga de trabalho"],
            boundaries: ["Informações confidenciais", "Documentos internos", "Dados pessoais de terceiros"],
            verificationStatus: person.index % 4 === 3 ? VerificationStatus.PENDING : VerificationStatus.VERIFIED,
            privacy: {
              create: {
                showRealName: person.privacyMode === "PUBLIC",
                showSurname: person.privacyMode === "PUBLIC",
                showPhoto: person.privacyMode === "PUBLIC",
                showCurrentCompany: true,
                showCity: person.privacyMode === "PUBLIC",
                showExactDates: false,
                showFullHistory: false,
                searchableByCompany: true,
                searchableByProfession: true,
              },
            },
            experiences: {
              create: {
                companyId: company.id,
                professionId: profession.id,
                title: person.title,
                area: person.area,
                isCurrent: true,
                startedAt,
                summary: "Experiência demonstrativa criada exclusivamente para o MVP acadêmico da Insidely.",
              },
            },
            availability: {
              create: [2, 4, 7].map((days, slotIndex) => {
                const startsAt = new Date();
                startsAt.setDate(startsAt.getDate() + days + (person.index % 3));
                startsAt.setHours(18 + slotIndex, person.index % 2 ? 30 : 0, 0, 0);
                const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
                return { startsAt, endsAt };
              }),
            },
            verifications: {
              create: {
                method: "Documento profissional",
                status: person.index % 4 === 3 ? VerificationStatus.PENDING : VerificationStatus.VERIFIED,
                reviewedAt: person.index % 4 === 3 ? null : new Date(),
                adminNotes: "Registro demonstrativo. Nenhum documento real foi utilizado.",
              },
            },
          },
        },
      },
      include: { professionalProfile: true },
    });
    if (!user.professionalProfile) throw new Error("Perfil profissional não criado");
    createdProfiles.push({ id: user.professionalProfile.id, userId: user.id, index: person.index });
  }

  const now = new Date();
  for (const profile of createdProfiles.slice(0, 16)) {
    const startsAt = new Date(now.getTime() - (profile.index + 3) * 24 * 60 * 60 * 1000);
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        professionalProfileId: profile.id,
        startsAt,
        durationMinutes: 30,
        topics: ["Rotina", "Gestão"],
        goals: "Entender como a função varia entre equipes e momentos da empresa.",
        status: BookingStatus.COMPLETED,
        subtotalCents: 5000,
        feeCents: 500,
        totalCents: 5500,
        payment: { create: { status: PaymentStatus.APPROVED, amountCents: 5500, paidAt: startsAt, providerRef: `SIM-${profile.index}` } },
        conversation: { create: {} },
        review: {
          create: {
            userId: customer.id,
            professionalProfileId: profile.id,
            rating: 4 + (profile.index % 2), clarity: 5, usefulness: 5, contextualization: 5,
            comment: "Conversa clara, contextualizada e muito útil para preparar minha decisão.",
          },
        },
      },
      include: { conversation: true },
    });
    if (booking.conversation) {
      await prisma.message.createMany({ data: [
        { conversationId: booking.conversation.id, senderId: customer.id, body: "Obrigado por reservar este tempo. Quero entender melhor a rotina." },
        { conversationId: booking.conversation.id, senderId: profile.userId, body: "Perfeito. Vou contextualizar minha experiência sem compartilhar informações confidenciais." },
      ] });
    }
  }

  const consultant = createdProfiles[0];
  const future = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const upcoming = await prisma.booking.create({
    data: {
      customerId: customer.id, professionalProfileId: consultant.id, startsAt: future, durationMinutes: 30,
      topics: ["Rotina", "Liderança", "Carga de trabalho"], goals: "Entender o dia a dia e chegar mais preparado ao processo seletivo.",
      status: BookingStatus.CONFIRMED, subtotalCents: 5000, feeCents: 500, totalCents: 5500,
      payment: { create: { status: PaymentStatus.APPROVED, amountCents: 5500, paidAt: now, providerRef: "SIM-UPCOMING" } },
      conversation: { create: {} },
    }, include: { conversation: true },
  });
  if (upcoming.conversation) await prisma.message.create({ data: { conversationId: upcoming.conversation.id, senderId: consultant.userId, body: "Conversa confirmada. Se quiser, envie os temas prioritários por aqui." } });

  await prisma.favorite.createMany({ data: createdProfiles.slice(0, 6).map((profile) => ({ userId: customer.id, professionalProfileId: profile.id })) });
  await prisma.profileView.createMany({ data: createdProfiles.flatMap((profile) => Array.from({ length: (profile.index % 6) + 1 }, (_, view) => ({ professionalProfileId: profile.id, viewerHash: `seed-viewer-${view}` }))) });
  await prisma.notification.createMany({ data: [
    { userId: customer.id, title: "Conversa confirmada", body: "Seu encontro com o profissional está na agenda.", href: "/dashboard/agendamentos" },
    { userId: consultant.userId, title: "Nova consulta", body: "Você recebeu uma nova conversa confirmada.", href: "/consultor/consultas" },
  ] });

  const realitySlugs = ["desenvolvimento-de-software", "dados", "ux-ui", "enfermagem", "vendas", "educacao"];
  for (const slug of realitySlugs) {
    const profession = professionBySlug.get(slug);
    if (!profession) continue;
    await prisma.realityCheck.create({ data: {
      professionId: profession.id,
      title: `O que ninguém te conta antes de trabalhar com ${profession.name.toLocaleLowerCase("pt-BR")}?`,
      intro: "Um retrato geral e ilustrativo para você chegar às conversas com perguntas melhores.",
      imagined: ["Trabalho totalmente previsível", "Autonomia imediata", "Rotina igual em toda empresa"],
      practical: ["Prioridades mudam", "Contexto e equipe importam", "Aprendizado inclui comunicação e revisão"],
      routine: { foco: 35, reunioes: 20, revisao: 15, planejamento: 15, suporte: 15 },
    } });
  }

  const pending = createdProfiles[3];
  await prisma.report.create({ data: { reporterId: customer.id, targetUserId: pending.userId, category: "COMPORTAMENTO_INADEQUADO", description: "Registro demonstrativo para testar a fila de moderação." } });

  console.log(`Seed concluído: ${generated.length} profissionais, ${companies.length} empresas e ${professions.length} profissões.`);
  console.log(`Usuários demo: demo@insidely.com, consultor@insidely.com e admin@insidely.com | Senha: ${DEMO_PASSWORD}`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
