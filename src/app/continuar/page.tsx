import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

export default async function ContinuePage() {
  const user = await requireUser();
  if (!user.onboardingCompleted) redirect("/onboarding");
  redirect(user.role === "CONSULTANT" ? "/consultor" : user.role === "ADMIN" ? "/admin" : "/dashboard");
}
