import { getSupabaseAdmin } from "./lib/supabase-admin";

// The test fixture intentionally uses tables added by migrations beyond generated database.types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type E2EAccount = { authId: string; userId: string; email: string; password: string; name: string };
export type E2EState = { customer: E2EAccount; consultant: E2EAccount; profileId: string; slotId: string; bookingId?: string; reportId?: string; seededCompanyId?: string; seededProfessionId?: string };

const defaultE2ESupabaseUrl = "https://ifacnetraghfnvbilvhh.supabase.co";
function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^(['"])(.*)\1$/, "$2");
}
function validHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  if (/^[a-z0-9]{20}$/.test(value)) return true;
  try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:"; } catch { return false; }
}
const configuredUrl = cleanEnv(process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
const url = validHttpUrl(configuredUrl)
  ? (/^[a-z0-9]{20}$/.test(configuredUrl) ? `https://${configuredUrl}.supabase.co` : configuredUrl)
  : defaultE2ESupabaseUrl;
const serviceKey = cleanEnv(process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
export const authenticatedE2EEnabled = Boolean(url && serviceKey);

function adminClient() {
  return getSupabaseAdmin() as AnyClient;
}

function id() { return crypto.randomUUID(); }

async function createAuthAccount(client: AnyClient, name: string, role: "USER" | "CONSULTANT") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const configuredEmail = role === "USER" ? cleanEnv(process.env.E2E_USER_EMAIL) : cleanEnv(process.env.E2E_CONSULTANT_EMAIL);
  const email = configuredEmail ?? `e2e.${role.toLowerCase()}.${suffix}@insidely.test`;
  const configuredPassword = role === "USER" ? cleanEnv(process.env.E2E_USER_PASSWORD) : cleanEnv(process.env.E2E_CONSULTANT_PASSWORD);
  // A random password keeps local fixtures non-reusable and avoids putting credentials in source.
  const password = configuredPassword ?? `E2e-${crypto.randomUUID()}-Aa9!`;
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, role } });
  if (error || !data.user) throw new Error(`Could not create E2E auth account: ${error?.message ?? "missing user"}`);
  const userId = id();
  const now = new Date().toISOString();
  const { error: insertError } = await client.from("User").insert({ id: userId, auth_user_id: data.user.id, name, email, role, onboardingCompleted: true, createdAt: now, updatedAt: now });
  if (insertError) throw new Error(`Could not seed E2E application user: ${insertError.message}`);
  return { authId: data.user.id, userId, email, password, name } satisfies E2EAccount;
}

export async function seedAuthenticatedFlow(): Promise<E2EState> {
  const client = adminClient();
  const [{ data: initialCompany, error: companyError }, { data: initialProfession, error: professionError }] = await Promise.all([
    client.from("Company").select("id").limit(1).single(),
    client.from("Profession").select("id").limit(1).single(),
  ]);
  let company = initialCompany;
  let profession = initialProfession;
  let seededCompanyId: string | undefined;
  let seededProfessionId: string | undefined;
  const now = new Date().toISOString();
  if (companyError?.code === "PGRST116" || !company) {
    seededCompanyId = id();
    const { data, error } = await client.from("Company").insert({ id: seededCompanyId, slug: `e2e-company-${seededCompanyId.slice(0, 8)}`, name: "Empresa E2E", sector: "Tecnologia", description: "Fixture isolado do E2E.", logoText: "E2E", color: "#111111", location: "São Paulo", createdAt: now, updatedAt: now }).select("id").single();
    if (error || !data) throw new Error(`Could not seed E2E company: ${error?.message ?? "missing company"}`);
    company = data;
  }
  if (professionError?.code === "PGRST116" || !profession) {
    seededProfessionId = id();
    const { data, error } = await client.from("Profession").insert({ id: seededProfessionId, slug: `e2e-profession-${seededProfessionId.slice(0, 8)}`, name: "Consultoria E2E", category: "Tecnologia", description: "Fixture isolado do E2E.", accent: "#111111", createdAt: now, updatedAt: now }).select("id").single();
    if (error || !data) throw new Error(`Could not seed E2E profession: ${error?.message ?? "missing profession"}`);
    profession = data;
  }

  const customer = await createAuthAccount(client, "Cliente E2E", "USER");
  const consultant = await createAuthAccount(client, "Consultor E2E", "CONSULTANT");
  const profileId = id();
  const slotId = id();
  const { error: profileError } = await client.from("ProfessionalProfile").insert({
    id: profileId,
    userId: consultant.userId,
    headline: "Consultor E2E de cultura e rotina",
    bio: "Perfil criado exclusivamente para o fluxo autenticado determinístico.",
    location: "São Paulo",
    region: "Sudeste",
    workMode: "REMOTE",
    seniority: "SENIOR",
    yearsExperience: 8,
    price30Cents: 10000,
    price60Cents: 18000,
    responseHours: 12,
    privacyMode: "PUBLIC",
    pseudonym: null,
    avatarSeed: "e2e-consultant",
    topics: ["Rotina", "Cultura"],
    boundaries: ["Sem informação confidencial"],
    verificationStatus: "VERIFIED",
    isActive: true,
    pixKey: "e2e@insidely.test",
    stripeAccountId: `acct_e2e_${profileId}`,
    stripeOnboardingStatus: "COMPLETE",
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    createdAt: now,
    updatedAt: now,
  } as never);
  if (profileError) throw new Error(`Could not seed E2E professional profile: ${profileError.message}`);

  const { error: privacyError } = await client.from("PrivacySettings").insert({ id: id(), professionalProfileId: profileId, showRealName: true, showSurname: true, showPhoto: false, showCurrentCompany: true, showCity: true, showExactDates: true, showFullHistory: true, searchableByCompany: true, searchableByProfession: true, updatedAt: now });
  if (privacyError) throw new Error(`Could not seed E2E privacy settings: ${privacyError.message}`);
  const { error: experienceError } = await client.from("EmploymentExperience").insert({ id: id(), professionalProfileId: profileId, companyId: company.id, professionId: profession.id, title: "Consultor E2E", area: "Cultura", isCurrent: true, startedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), summary: "Experiência de teste isolada.", createdAt: now });
  if (experienceError) throw new Error(`Could not seed E2E experience: ${experienceError.message}`);

  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();
  const { error: availabilityError } = await client.from("Availability").insert({ id: slotId, professionalProfileId: profileId, startsAt, endsAt, isBooked: false, createdAt: now });
  if (availabilityError) throw new Error(`Could not seed E2E availability: ${availabilityError.message}`);
  return { customer, consultant, profileId, slotId, seededCompanyId, seededProfessionId };
}

export function serviceClient() { return adminClient(); }

export async function cleanAuthenticatedFlow(state: E2EState) {
  const client = adminClient();
  const userIds = [state.customer.userId, state.consultant.userId];
  if (state.bookingId) {
    await client.from("Review").delete().eq("bookingId", state.bookingId);
    await client.from("Report").delete().eq("bookingId", state.bookingId);
    await client.from("TransferAttempt").delete().eq("bookingId", state.bookingId);
    await client.from("StripeWebhookEvent").delete().like("id", `evt_e2e_${state.bookingId}%`);
    await client.from("Booking").delete().eq("id", state.bookingId);
  }
  await client.from("Report").delete().in("reporterId", userIds);
  await client.from("Notification").delete().in("userId", userIds);
  await client.from("Availability").delete().eq("id", state.slotId);
  await client.from("PrivacySettings").delete().eq("professionalProfileId", state.profileId);
  await client.from("EmploymentExperience").delete().eq("professionalProfileId", state.profileId);
  await client.from("ProfessionalProfile").delete().eq("id", state.profileId);
  if (state.seededCompanyId) await client.from("Company").delete().eq("id", state.seededCompanyId);
  if (state.seededProfessionId) await client.from("Profession").delete().eq("id", state.seededProfessionId);
  await client.from("User").delete().in("id", userIds);
  await Promise.all([client.auth.admin.deleteUser(state.customer.authId), client.auth.admin.deleteUser(state.consultant.authId)]);
}
