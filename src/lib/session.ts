import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";

export async function requireUser(roles?: Role[]) {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  if (roles && !roles.includes(session.user.role)) redirect("/dashboard");
  return session.user;
}

