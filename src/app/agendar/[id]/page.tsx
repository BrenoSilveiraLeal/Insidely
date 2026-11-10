import { MessageRequestForm } from "@/components/message-request-form";
import { notFound, redirect } from "next/navigation";
import { viewerOwnsProfile } from "@/lib/review-replies";
import { PublicShell } from "@/components/public-shell";
import { money, publicName } from "@/lib/format";
import { chatFeeCents } from "@/lib/booking-policy";
import { getProfessional } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { getCustomerIdentity } from "@/lib/customer-identity";
import { CustomerIdentityForm } from "@/components/customer-identity-form";

export const metadata = { title: "Abrir chat" };
export const dynamic = "force-dynamic";

// Conversations are chat only: paying opens the chat at once (no time slot).
export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(undefined, { nextPath: "/agendar/" + id });
  const [profile, identity] = await Promise.all([getProfessional(id), getCustomerIdentity(user.id)]);
  if (!profile) notFound();
  // Nobody opens a chat with their own profile (create_message_booking refuses it too).
  if (await viewerOwnsProfile(user.id, profile.id)) redirect(`/profissional/${profile.id}`);
  if (!identity) return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Antes do primeiro chat</span><h1>Identifique-se para conversar.</h1><p>Com {publicName(profile)} · leva menos de um minuto e só é pedido uma vez.</p></div></section><section className="section"><div className="container profile-layout">
    <section className="panel"><CustomerIdentityForm next={`/agendar/${profile.id}`}/></section>
    <aside className="booking-box"><span className="eyebrow">Por que pedimos o CPF</span><h2>Segurança para os dois lados.</h2><p>As conversas acontecem entre pessoas que não se conhecem. Com a identificação, a Insidely consegue responder a denúncias e a autoridades se algo grave acontecer.</p><p className="muted">O consultor vê apenas o CPF parcialmente mascarado e a sua idade. O CPF não pode ser usado em outra conta.</p></aside>
  </div></section></PublicShell>;
  const price = profile.messagePriceCents ?? profile.price30Cents;
  return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Chat</span><h1>Converse por escrito.</h1><p>Com {publicName(profile)} · pague e o chat abre na hora.</p></div></section><section className="section"><div className="container profile-layout">
    <MessageRequestForm profileId={profile.id} price={money(price + chatFeeCents(price))}/>
    <aside className="booking-box"><span className="eyebrow">Acordo da conversa</span><h2>Experiência, não garantia.</h2><p>O consultor fala da própria vivência. Não representa a empresa, não promete contratação e não compartilha informação confidencial.</p><p className="muted">O pagamento fica retido pela Insidely e só vai para o consultor depois que a conversa termina.</p></aside>
  </div></section></PublicShell>;
}
