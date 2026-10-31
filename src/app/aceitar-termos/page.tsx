import Link from "next/link";
import { redirect } from "next/navigation";
import { AcceptTermsForm } from "@/components/accept-terms-form";
import { safeInternalPath } from "@/lib/security";
import { hasAcceptedCurrentTerms, requireUser } from "@/lib/session";
import { TERMS_CHANGES } from "@/lib/terms";

export const metadata = { title: "Termos atualizados" };
export const dynamic = "force-dynamic";

// Shown once per account whenever TERMS_VERSION changes.
export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await requireUser(undefined, { allowIncomplete: true, allowWithoutMfa: true, nextPath: "/aceitar-termos" });
  const destination = safeInternalPath(next ?? null, "/continuar");
  if (await hasAcceptedCurrentTerms(user.id)) redirect(destination);
  return <main className="auth-page"><section className="auth-art" style={{ background: "var(--amber)" }}><h1>Atualizamos as regras.</h1></section><section className="auth-panel"><AcceptTermsForm>
    <input type="hidden" name="next" value={destination}/>
    <span className="eyebrow">Termos de Uso e Política de Privacidade</span>
    <h2>Leia o que mudou.</h2>
    <ul className="terms-changes">{TERMS_CHANGES.map((item) => <li key={item}>{item}</li>)}</ul>
    <p className="terms-full">Leia os textos completos: <Link className="inline-link" href="/termos" target="_blank">Termos de Uso</Link> e <Link className="inline-link" href="/privacidade" target="_blank">Política de Privacidade</Link>.</p>
  </AcceptTermsForm></section></main>;
}
