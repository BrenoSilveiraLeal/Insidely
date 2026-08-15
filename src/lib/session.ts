import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSocialSessionToken, SOCIAL_SESSION_COOKIE } from "@/lib/social-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const userSelect = { id: true, name: true, email: true, image: true, role: true, onboardingCompleted: true } as const;

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (supabaseUser) {
    const { data: stored } = await supabase.from("User").select("id, name, email, image, role, onboardingCompleted").eq("auth_user_id", supabaseUser.id).maybeSingle();
    if (stored) return { ...stored, role: stored.role as Role };
  }
  const session = await auth();
  if (session?.user?.id) {
    return prisma.user.findUnique({ where: { id: session.user.id }, select: userSelect });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(SOCIAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = parseSocialSessionToken(token);
  if (!parsed) return null;
  return prisma.user.findUnique({ where: { id: parsed.userId }, select: userSelect });
}

export async function requireUser(roles?: Role[], options?: { allowIncomplete?: boolean }) {
  const stored = await getAuthenticatedUser();
  if (!stored) redirect("/entrar");
  if (roles && !roles.includes(stored.role)) redirect(stored.role === Role.CONSULTANT ? "/consultor" : "/dashboard");
  if (!options?.allowIncomplete && !stored.onboardingCompleted) redirect("/onboarding");
  return stored;
}
