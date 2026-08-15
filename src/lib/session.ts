import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser(roles?: Role[], options?: { allowIncomplete?: boolean }) {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  const stored = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, image: true, role: true, onboardingCompleted: true } });
  if (!stored) redirect("/entrar");
  if (roles && !roles.includes(stored.role)) redirect(stored.role === Role.CONSULTANT ? "/consultor" : "/dashboard");
  if (!options?.allowIncomplete && !stored.onboardingCompleted) redirect("/onboarding");
  return { ...session.user, ...stored };
}
