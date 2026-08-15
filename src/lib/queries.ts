import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export type Experience = { id: string; title: string; professionalProfileId?: string; company: { name: string }; profession: { name: string } };
export type PublicReview = { id: string; rating: number; comment: string; user: { name: string } };
export type Availability = { id: string; startsAt: Date; endsAt: Date; isBooked: boolean };
export type VerificationDocument = { id: string; originalName: string; sizeBytes: number };
export type PublicProfile = { id: string; headline: string; bio: string; pseudonym: string | null; price30Cents: number; price60Cents: number; responseHours: number; location: string; workMode: string; verificationStatus: string; privacyMode: string; topics: string[]; boundaries: string[]; experiences: Experience[]; reviews: PublicReview[]; availability: Availability[]; user: { name: string; image: string | null }; privacy: { showPhoto: boolean } | null };
export type Row = {
  id: string; slug: string; name: string; email: string; role: string; image: string | null;
  headline: string; location: string; workMode: string; price30Cents: number; privacyMode: string; pseudonym: string | null; verificationStatus: string;
  category: string; sector: string; description: string; logoText: string; color: string; accent: string;
  isActive: boolean; experiences: Experience[]; reviews: PublicReview[]; availability: Availability[]; topics: string[]; boundaries: string[]; status: string; amountCents: number; method: string; documents: VerificationDocument[]; professionalProfile: { user: { name: string }; headline: string; experiences: Experience[] }; profession: { slug: string; name: string; category: string; accent: string }; title: string; intro: string; imagined: string[]; practical: string[]; routine: Record<string, number>; user: { name: string; image: string | null }; privacy: { showPhoto: boolean } | null;
  _count: { experiences: number }; 
  [key: string]: unknown;
};
export type DashboardMessage = { id: string; body: string; senderId: string; sender: { name: string }; createdAt: string };
export type DashboardConversation = { id: string; messages: DashboardMessage[] };
export type DashboardBooking = { id: string; status: string; feeCents: number; totalCents: number; startsAt: Date; durationMinutes: number; topics: string[]; goals: string; consultantConfirmedAt: Date | null; consultantRecordingConsent: boolean; meetingUrl: string | null; customer: { name: string }; payment: { status: string; amountCents: number } | null; conversation: DashboardConversation | null };
export type ViewerBooking = DashboardBooking & { professional: { user: { name: string } }; customerConfirmedAt: Date | null; review?: { rating: number; comment: string } | null };
export type ViewerDashboard = { id: string; name: string; customerBookings: ViewerBooking[]; favorites: { id: string; professionalProfile: PublicProfile }[]; notifications: { id: string }[] };
export type ConsultantDashboard = { id: string; headline: string; bio: string; location: string; region: string; workMode: string; seniority: string; yearsExperience: number; price30Cents: number; price60Cents: number; responseHours: number; topics: string[]; boundaries: string[]; experiences: Array<{ companyId: string; professionId: string; title: string }>; user: { name: string; image: string | null }; privacy: { showRealName: boolean; showSurname: boolean; showPhoto: boolean; showCurrentCompany: boolean; showCity: boolean; showExactDates: boolean; showFullHistory: boolean; searchableByCompany: boolean; searchableByProfession: boolean } | null; bookings: DashboardBooking[]; availability: { id: string; startsAt: Date; endsAt: Date; isBooked: boolean }[]; profileViews: { id: string }[]; favorites: { id: string }[]; verificationStatus: string };
async function table(name: string, query = "*", limit?: number): Promise<Row[]> {
  const supabase = createSupabasePublicClient();
  let request = supabase.from(name).select(query);
  if (limit) request = request.limit(limit);
  const { data, error } = await request;
  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

export function getProfessionalInclude() { return {}; }
async function home() {
  const supabase = createSupabasePublicClient();
  const [metrics, professionals, companies, professions] = await Promise.all([
    supabase.from("home_metrics").select("active_professionals,represented_companies,completed_conversations,average_rating").single(),
    table("public_profile_cards", "*", 8), table("public_company_cards", "*", 8), table("public_profession_cards", "*", 6),
  ]);
  if (metrics.error) throw new Error(`Supabase metrics query failed: ${metrics.error.message}`);
  return { professionalCount: Number(metrics.data.active_professionals), companyCount: Number(metrics.data.represented_companies), completedCount: Number(metrics.data.completed_conversations), rating: Number(metrics.data.average_rating), professionals, companies, professions };
}
export const getHomeData = home;
export const getPublicCompanies = () => table("public_company_cards");
export const getPublicProfessions = () => table("public_profession_cards");
export const getPublicRealityChecks = () => table("RealityCheck", "*, profession:Profession(*)");
export async function searchProfessionals(params: { q?: string; company?: string; profession?: string; mode?: string }) { const rows = await table("public_profile_cards"); const q = params.q?.toLowerCase(); return rows.filter((p) => (!params.mode || p.workMode === params.mode) && (!q || JSON.stringify(p).toLowerCase().includes(q))); }
export async function getProfessional(id: string): Promise<PublicProfile | null> { const supabase = createSupabasePublicClient(); const { data, error } = await supabase.from("public_profile_cards").select("*").eq("id", id).maybeSingle(); if (error) throw new Error(error.message); if (data) { data.topics = Array.isArray(data.topics) ? data.topics : []; data.boundaries = Array.isArray(data.boundaries) ? data.boundaries : []; data.availability = Array.isArray(data.availability) ? data.availability : []; data.experiences = Array.isArray(data.experiences) ? data.experiences.map((experience: Experience) => ({ ...experience, profession: experience.profession ?? { name: "Profissão não informada" }, company: experience.company ?? { name: "Empresa não informada" } })) : []; data.experiences.forEach((experience: Experience, index: number) => { experience.id ??= `experience-${index}`; }); data.reviews = Array.isArray(data.reviews) ? data.reviews.map((review: PublicReview) => ({ ...review, user: review.user ?? { name: "Consultante" } })) : []; data.reviews.forEach((review: PublicReview, index: number) => { review.id ??= `review-${index}`; }); } return data; }
export async function getViewerDashboard(userId: string): Promise<ViewerDashboard | null> { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.from("User").select("*, customerBookings:Booking(*), favorites:Favorite(*), notifications:Notification(*)").eq("id", userId).maybeSingle(); if (error) throw new Error(error.message); return data; }
export async function getConsultantDashboard(userId: string): Promise<ConsultantDashboard | null> { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.rpc("get_consultant_dashboard", { p_user_id: userId }); if (error) throw new Error(`Supabase consultant dashboard query failed: ${error.message}`); return data as ConsultantDashboard | null; }
export async function getAdminData() { const [users, professionals, bookings, pending, reports, payments] = await Promise.all([table("User"), table("ProfessionalProfile"), table("Booking"), table("Verification"), table("Report"), table("Payment")]); return { users: users.length, professionals: professionals.length, bookings: bookings.length, pending, reports, revenueCents: payments.filter((p) => p.status === "APPROVED").reduce((sum, p) => sum + Number(p.amountCents || 0), 0) }; }
export async function getCompanyBySlug(slug: string) { const supabase = createSupabasePublicClient(); const { data } = await supabase.from("public_company_details").select("*").eq("slug", slug).maybeSingle(); if (data && !Array.isArray(data.experiences)) data.experiences = []; return data; }
export async function getProfessionBySlug(slug: string) { const supabase = createSupabasePublicClient(); const { data } = await supabase.from("public_profession_details").select("*").eq("slug", slug).maybeSingle(); if (data && !Array.isArray(data.experiences)) data.experiences = []; return data; }
export async function getRealityCheckBySlug(slug: string): Promise<Row | null> { const supabase = createSupabasePublicClient(); const { data, error } = await supabase.from("RealityCheck").select("*, profession:Profession!inner(*)").eq("profession.slug", slug).maybeSingle(); if (error) throw new Error(`Supabase Reality Check query failed: ${error.message}`); return data as unknown as Row | null; }
export async function getUserById(id: string) { const supabase = await createSupabaseServerClient(); const { data } = await supabase.from("User").select("*, professionalProfile:ProfessionalProfile(*)").eq("id", id).maybeSingle(); return data; }
export async function getBookingForUser(id: string, userId: string) { const supabase = await createSupabaseServerClient(); const { data } = await supabase.from("Booking").select("*, professional:ProfessionalProfile(*, user:User(*)), payment:Payment(*)").eq("id", id).eq("customerId", userId).maybeSingle(); return data; }
