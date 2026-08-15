import { BookingStatus, VerificationStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export function getProfessionalInclude() { return {
  user: { select: { id: true, name: true, image: true } },
  privacy: true,
  experiences: { include: { company: true, profession: true }, orderBy: { isCurrent: "desc" as const } },
  reviews: { select: { rating: true } },
  availability: { where: { startsAt: { gt: new Date() }, isBooked: false }, orderBy: { startsAt: "asc" as const }, take: 4 },
} as const; }

async function getHomeDataUncached() {
  try {
    const [professionalCount, companyCount, completedCount, reviewAggregate, professionals, companies, professions] = await Promise.all([
      prisma.professionalProfile.count({ where: { isActive: true } }),
      prisma.company.count(),
      prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.professionalProfile.findMany({ where: { isActive: true }, include: getProfessionalInclude(), take: 8, orderBy: { createdAt: "asc" } }),
      prisma.company.findMany({ include: { _count: { select: { experiences: true } } }, take: 10, orderBy: { name: "asc" } }),
      prisma.profession.findMany({ include: { _count: { select: { experiences: true } } }, take: 12, orderBy: { name: "asc" } }),
    ]);
    return { professionalCount, companyCount, completedCount, rating: reviewAggregate._avg.rating ?? 0, professionals, companies, professions };
  } catch (error) {
    console.warn("Home data fallback: database unavailable", error);
    return {
      professionalCount: 0,
      companyCount: 0,
      completedCount: 0,
      rating: 0,
      professionals: [],
      companies: [],
      professions: [],
    };
  }
}

// Dados editoriais públicos mudam pouco. Este cache evita uma nova conexão ao
// banco a cada navegação, mas expira rapidamente para não deixar a home defasada.
export const getHomeData = unstable_cache(getHomeDataUncached, ["public-home-data"], { revalidate: 120 });

export const getPublicCompanies = unstable_cache(
  () => prisma.company.findMany({ include: { _count: { select: { experiences: true } } }, orderBy: { name: "asc" } }),
  ["public-companies"],
  { revalidate: 300 },
);

export const getPublicProfessions = unstable_cache(
  () => prisma.profession.findMany({ include: { _count: { select: { experiences: true } } }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ["public-professions"],
  { revalidate: 300 },
);

export const getPublicRealityChecks = unstable_cache(
  () => prisma.realityCheck.findMany({ include: { profession: true } }),
  ["public-reality-checks"],
  { revalidate: 300 },
);

export async function searchProfessionals(params: { q?: string; company?: string; profession?: string; mode?: string }) {
  const q = params.q?.trim();
  return prisma.professionalProfile.findMany({
    where: {
      isActive: true,
      ...(params.mode ? { workMode: params.mode as "REMOTE" | "HYBRID" | "ONSITE" } : {}),
      experiences: { some: {
        ...(params.company ? { company: { slug: params.company } } : {}),
        ...(params.profession ? { profession: { slug: params.profession } } : {}),
      } },
      ...(q ? { OR: [
        { headline: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { experiences: { some: { company: { name: { contains: q, mode: "insensitive" } } } } },
        { experiences: { some: { profession: { name: { contains: q, mode: "insensitive" } } } } },
      ] } : {}),
    },
    include: getProfessionalInclude(),
    orderBy: [{ verificationStatus: "desc" }, { createdAt: "asc" }],
  });
}

export async function getProfessional(id: string) {
  return prisma.professionalProfile.findUnique({
    where: { id },
    include: { ...getProfessionalInclude(), profileViews: true, reviews: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 } },
  });
}

export async function getViewerDashboard(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      customerBookings: { include: { professional: { include: getProfessionalInclude() }, payment: true, review: true, conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } } }, orderBy: { startsAt: "desc" } },
      favorites: { include: { professionalProfile: { include: getProfessionalInclude() } }, orderBy: { createdAt: "desc" } },
      notifications: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
}

export async function getConsultantDashboard(userId: string) {
  return prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      ...getProfessionalInclude(),
      privacy: true,
      availability: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } },
      bookings: { include: { customer: { select: { name: true } }, payment: true, conversation: { include: { messages: { include: { sender: { select: { name: true } } }, orderBy: { createdAt: "asc" } } } } }, orderBy: { startsAt: "desc" } },
      profileViews: true,
      favorites: true,
    },
  });
}

export async function getAdminData() {
  const [users, professionals, bookings, pending, reports, revenue] = await Promise.all([
    prisma.user.count(), prisma.professionalProfile.count(), prisma.booking.count(),
    prisma.verification.findMany({ where: { status: VerificationStatus.PENDING }, include: { documents: true, professionalProfile: { include: { user: true, experiences: { include: { company: true } } } } }, orderBy: { createdAt: "asc" } }),
    prisma.report.findMany({ include: { reporter: true, targetUser: true }, orderBy: { createdAt: "desc" } }),
    prisma.payment.aggregate({ where: { status: "APPROVED" }, _sum: { amountCents: true } }),
  ]);
  return { users, professionals, bookings, pending, reports, revenueCents: revenue._sum.amountCents ?? 0 };
}
