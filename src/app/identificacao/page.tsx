import { redirect } from "next/navigation";
import { CustomerIdentityForm } from "@/components/customer-identity-form";
import { Role } from "@/lib/domain";
import { safeInternalPath } from "@/lib/security";
import { hasCustomerIdentity, requireUser } from "@/lib/session";

export const metadata = { title: "Complete seu cadastro" };
export const dynamic = "force-dynamic";

// Accounts created before the CPF became mandatory land here before any other page.
export default async function IdentificationPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await requireUser(undefined, { allowIncomplete: true, nextPath: "/identificacao" });
  if (!user.onboardingCompleted) redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  const destination = safeInternalPath(next ?? null, user.role === Role.CONSULTANT ? "/consultor" : user.role === Role.ADMIN ? "/admin" : "/dashboard");
  if (user.role === Role.ADMIN || await hasCustomerIdentity()) redirect(destination);
  return <main className="auth-page"><section className="auth-art" style={{ background: "var(--amber)" }}><h1>Segurança para os dois lados.</h1></section><section className="auth-panel onboarding-panel"><div className="auth-form form-stack">
    <span className="eyebrow">Olá, {user.name?.split(" ")[0] || "Pessoa"}</span>
    <h2>Complete seu cadastro.</h2>
    <p className="muted">Toda conta na Insidely, de cliente ou de consultor, se identifica com CPF e data de nascimento. As conversas acontecem por vídeo entre pessoas que não se conhecem; com a identificação, a plataforma consegue responder a denúncias e a autoridades se algo grave acontecer. O CPF não aparece no seu perfil e não pode ser usado em outra conta.</p>
    <CustomerIdentityForm next={destination}/>
  </div></section></main>;
}
