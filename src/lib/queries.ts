import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

type Row = Record<string, unknown>;
async function table(name: string, query = "*"): Promise<Row[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.from(name).select(query);
  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return (data ?? []) as Row[];
}

export function getProfessionalInclude() { return {}; }
async function home() {
  const [professionals, companies, professions] = await Promise.all([table("public_profile_cards"), table("public_company_cards"), table("public_profession_cards")]);
  return { professionalCount: professionals.length, companyCount: companies.length, completedCount: 0, rating: 0, professionals, companies, professions };
}
export const getHomeData = home;
export const getPublicCompanies = () => table("public_company_cards");
export const getPublicProfessions = () => table("public_profession_cards");
export const getPublicRealityChecks = () => table("RealityCheck", "*, profession:Profession(*)");
export async function searchProfessionals(params: { q?: string; company?: string; profession?: string; mode?: string }) { const rows = await table("public_profile_cards"); const q = params.q?.toLowerCase(); return rows.filter((p) => (!params.mode || p.workMode === params.mode) && (!q || JSON.stringify(p).toLowerCase().includes(q))); }
export async function getProfessional(id: string) { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.from("ProfessionalProfile").select("*, user:User(id,name,image), privacy:PrivacySettings(*), experiences:EmploymentExperience(*, company:Company(*), profession:Profession(*)), availability:Availability(*), reviews:Review(*)").eq("id", id).maybeSingle(); if (error) throw new Error(error.message); return data; }
export async function getViewerDashboard(userId: string) { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.from("User").select("*, customerBookings:Booking(*), favorites:Favorite(*), notifications:Notification(*)").eq("id", userId).maybeSingle(); if (error) throw new Error(error.message); return data; }
export async function getConsultantDashboard(userId: string) { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.rpc("get_consultant_dashboard", { p_user_id: userId }); if (error) throw new Error(`Supabase consultant dashboard query failed: ${error.message}`); return data; }
export async function getAdminData() { const [users, professionals, bookings, pending, reports, payments] = await Promise.all([table("User"), table("ProfessionalProfile"), table("Booking"), table("Verification"), table("Report"), table("Payment")]); return { users: users.length, professionals: professionals.length, bookings: bookings.length, pending, reports, revenueCents: payments.filter((p) => p.status === "APPROVED").reduce((sum, p) => sum + Number(p.amountCents || 0), 0) }; }
export async function getCompanyBySlug(slug: string) { const supabase = await createSupabaseServerClient(); const { data } = await supabase.from("Company").select("*, experiences:EmploymentExperience(*)").eq("slug", slug).maybeSingle(); return data; }
export async function getProfessionBySlug(slug: string) { const supabase = await createSupabaseServerClient(); const { data } = await supabase.from("Profession").select("*, experiences:EmploymentExperience(*), realityCheck:RealityCheck(*)").eq("slug", slug).maybeSingle(); return data; }
export async function getRealityCheckBySlug(slug: string) { const supabase = await createSupabaseServerClient(); const { data } = await supabase.from("RealityCheck").select("*, profession:Profession!inner(*)").eq("Profession.slug", slug).maybeSingle(); return data; }
export async function getUserById(id: string) { const supabase = await createSupabaseServerClient(); const { data } = await supabase.from("User").select("*, professionalProfile:ProfessionalProfile(*)").eq("id", id).maybeSingle(); return data; }
export async function getBookingForUser(id: string, userId: string) { const supabase = await createSupabaseServerClient(); const { data } = await supabase.from("Booking").select("*, professional:ProfessionalProfile(*, user:User(*)), payment:Payment(*)").eq("id", id).eq("customerId", userId).maybeSingle(); return data; }
