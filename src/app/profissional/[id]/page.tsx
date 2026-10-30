import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BriefcaseBusiness, CalendarDays, ChevronDown, Clock, Flag, MapPin, ShieldCheck, Star } from "lucide-react";
import { reportProfileAction } from "@/app/actions";
import { FavoriteButton } from "@/components/favorite-button";
import { isNewProfile } from "@/lib/profile-age";
import { getIdentityVerifiedProfileIds, getProfileSignals, isWatchingAvailability } from "@/lib/profile-signals";
import { toggleAvailabilityWatchAction } from "@/app/actions";
import { getReviewReplies, reviewFeedback, viewerOwnsProfile } from "@/lib/review-replies";
import { replyToReviewAction, reportReviewAction } from "@/app/actions";
import { PublicShell } from "@/components/public-shell";
import { dateTimeInBrazil, initials, money, publicName, shortDate } from "@/lib/format";
import { getFavoriteState, getProfessional, recordProfileView } from "@/lib/queries";
import { headers } from "next/headers";
import { getAuthenticatedUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { const profile = await getProfessional((await params).id); return { title: profile ? "Perfil de " + publicName(profile) : "Perfil profissional" }; }

export default async function ProfessionalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ denuncia?: string; avaliacao?: string; resposta?: string }> }) {
  const { id } = await params;
  const { denuncia } = await searchParams;
  const viewerPromise = getAuthenticatedUser();
  const [profile, viewer, requestHeaders, isFavorite] = await Promise.all([
    getProfessional(id),
    viewerPromise,
    headers(),
    viewerPromise.then((currentViewer) => currentViewer ? getFavoriteState(id,currentViewer.id) : false),
  ]);
  if (!profile) notFound();
  const fingerprint = [requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? "", requestHeaders.get("user-agent") ?? ""].join("|");
  after(() => recordProfileView(profile.id, { userId: viewer?.id, fingerprint }).catch(() => {}));
  const name = publicName(profile);
  const reviews = profile.reviews ?? [];
  const isOwner = await viewerOwnsProfile(viewer?.id, profile.id);
  const replies = await getReviewReplies(reviews.map((review) => review.id));
  const query = await searchParams;
  const feedback = reviewFeedback(query.avaliacao, query.resposta);
  const availability = profile.availability ?? [];
  const now = new Date();
  const immediateCutoff = now.getTime() + 15 * 60_000;
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const photo = profile.privacy?.showPhoto ? profile.user.image : null;
  const cover = profile.privacy?.showPhoto ? profile.coverImage : null;
  const verification = profile.verificationStatus === "VERIFIED"
    ? { label: "Vínculo verificado pela Insidely", detail: "A Insidely conferiu o comprovante enviado por esta pessoa e confirmou o vínculo com a empresa indicada." }
    : profile.verificationStatus === "PENDING"
      ? { label: "Verificação em análise", detail: "Esta pessoa enviou um comprovante, que ainda está em análise. Até a conclusão, a Insidely não confirma que ela trabalha ou trabalhou na empresa indicada." }
      : { label: "Perfil não verificado", detail: "Esta pessoa não comprovou à Insidely que trabalha ou trabalhou na empresa indicada. As informações foram declaradas por ela e podem não ser verdadeiras; leve isso em conta antes de agendar." };
  const isNew = await isNewProfile(profile.id);
  const [verifiedIdentities, signals] = await Promise.all([getIdentityVerifiedProfileIds(), getProfileSignals(profile.id)]);
  const identityVerified = verifiedIdentities.has(profile.id);
  const watching = viewer ? await isWatchingAvailability(viewer.id, profile.id) : false;

  return <PublicShell>
    <section className={`profile-hero${cover ? " profile-hero-with-cover" : ""}`} style={cover ? { backgroundImage: `linear-gradient(90deg, rgba(23,32,51,.9), rgba(23,32,51,.45)), url(${cover})` } : undefined}>
      <div className="container">
        <div className={`avatar${photo ? " avatar-photo" : ""}`} style={{ width: 120, fontSize: "2.4rem", ...(photo ? { backgroundImage: `url(${photo})` } : {}) }}>{photo ? null : initials(name)}</div>
        <div className="card-meta"><span className={`badge${profile.verificationStatus === "VERIFIED" ? "" : " badge-unverified"}`}>{profile.verificationStatus === "VERIFIED" && <ShieldCheck size={13}/>} {verification.label}</span>{isNew && <span className="badge badge-new">Novo na Insidely</span>}{identityVerified && <span className="badge"><ShieldCheck size={13}/> Identidade verificada</span>}{signals.fastResponder && <span className="badge">Responde rápido</span>}<span className="badge">{profile.privacyMode === "PUBLIC" ? "Perfil público" : "Identidade protegida"}</span></div>
        <p className="verification-disclosure" role="note">{verification.detail}</p>
        <h1 className="profile-title">{name}</h1>
        <p className="section-copy">{profile.headline}</p>
        {profile.location && <p className="section-copy" style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={16} aria-hidden="true" />{profile.location}</p>}
      </div>
    </section>

    <section className="section">
      <div className="container profile-layout">
        <div className="grid">
          <article className="profile-main"><span className="eyebrow">Sobre a experiência</span><h2>Contexto que posso compartilhar</h2><p>{profile.bio}</p><div className="card-meta">{profile.topics.map(topic => <span className="badge" key={topic}>{topic}</span>)}</div></article>
          <article className="profile-main"><span className="eyebrow">Trajetória</span><h2>Experiência declarada</h2><ul className="detail-list">{profile.experiences.map((exp, index) => <li key={exp.id}><div><strong>{exp.title}</strong><br/><span className="muted">{exp.profession.name} · {exp.company.name}</span><br/>{/* The proof sent covers the main (first) experience; the others stay as declared. */}{index === 0 && profile.verificationStatus === "VERIFIED" ? <span className="experience-proof experience-proof-ok"><ShieldCheck size={13}/> Vínculo com {exp.company.name} verificado</span> : <span className="experience-proof">{index === 0 ? "Vínculo não verificado pela Insidely" : "Declarada pelo consultor"}</span>}</div><BriefcaseBusiness/></li>)}</ul><p className="muted">Datas exatas e histórico completo respeitam as escolhas de privacidade do consultor.</p></article>
          <article className="profile-main"><span className="eyebrow">Limites claros</span><h2>O que não entra na conversa</h2><ul>{profile.boundaries.map(item => <li key={item}>{item}</li>)}</ul></article>
          <article className="profile-main"><span className="eyebrow">{reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"}</span><h2>Depois das conversas</h2>
            {feedback && <p className={feedback.ok ? "form-feedback" : "form-error"} role={feedback.ok ? "status" : "alert"}>{feedback.text}</p>}
            {reviews.length ? <div className="list">{reviews.map(review => { const reply = replies.get(review.id); return <div className="review-block" key={review.id}>
              <div className="list-row review-row"><div><strong>{review.user.name && review.user.name.toLowerCase() !== "user" ? review.user.name : "Cliente da Insidely"}</strong><p className="review-comment">{review.comment}</p></div><span className="rating"><Star size={14} fill="currentColor"/> {review.rating}</span></div>
              {reply && <div className="review-reply"><strong>Resposta de {name}</strong><p>{reply}</p></div>}
              {isOwner && !reply && <details className="review-action"><summary>Responder publicamente</summary><form action={replyToReviewAction.bind(null, review.id, profile.id)} className="form-stack"><textarea className="textarea" name="body" minLength={2} maxLength={1000} required placeholder="Agradeça ou esclareça algo, com educação. A resposta fica pública."/><button className="button button-dark button-sm">Publicar resposta</button></form></details>}
              {viewer && !isOwner && <details className="review-action"><summary>Denunciar avaliação</summary><form action={reportReviewAction.bind(null, review.id, profile.id)} className="form-stack"><textarea className="textarea" name="reason" minLength={10} maxLength={1000} required placeholder="Por que esta avaliação não deveria estar publicada?"/><button className="button button-ghost button-sm">Enviar denúncia</button></form></details>}
            </div>; })}</div> : <p className="muted">Este perfil ainda não recebeu uma avaliação.</p>}</article>
        </div>

        <aside className="booking-box">
          <span className="eyebrow">Conversa individual</span>
          <h2>{money(profile.price30Cents)} <small>/ 30 min</small></h2>
          <ul className="detail-list"><li><span><Star size={15}/> Avaliação</span><strong>{average ? average.toFixed(1) : "Sem avaliações"}</strong></li><li><span><Clock size={15}/> Resposta</span><strong>{signals.medianResponseHours !== null ? `costuma responder em ${signals.medianResponseHours < 1 ? "menos de 1h" : `${Math.round(signals.medianResponseHours)}h`}` : `em até ${profile.responseHours}h`}</strong></li>{signals.attendanceRate !== null && <li><span><CalendarDays size={15}/> Comparecimento</span><strong>{signals.attendanceRate}% das conversas</strong></li>}<li><span><CalendarDays size={15}/> Próximo horário</span><strong>{availability[0] ? shortDate(availability[0].startsAt) : "A definir"}</strong></li></ul>

          <div className="availability-preview">
            <span className="eyebrow">Horários disponíveis · Brasília</span>
            {availability.length ? <div className="availability-preview-list">{availability.slice(0, 3).map(slot => { const availableNow = !slot.isBooked && slot.endsAt > now && slot.startsAt.getTime() <= immediateCutoff; return <Link className="availability-preview-item" href={`/agendar/${profile.id}?slot=${encodeURIComponent(slot.id)}`} key={slot.id}><span>{availableNow && <strong className="status">Disponível agora</strong>} {dateTimeInBrazil(slot.startsAt)}</span><span>Escolher</span></Link>; })}</div> : <div className="form-stack"><p className="muted">Este perfil ainda não abriu horários para conversa.</p><form action={toggleAvailabilityWatchAction.bind(null, profile.id)}><button className={`button ${watching ? "button-ghost" : "button-dark"} button-sm`}>{watching ? "✓ Você será avisado · cancelar" : "Avise-me quando abrir horário"}</button></form></div>}
          </div>

          {availability.length > 0 && <Link className="button button-dark button-block" href={`/agendar/${profile.id}`}>Ver todos os horários</Link>}
          <FavoriteButton profileId={profile.id} initialSaved={isFavorite}/>
          <p className="muted" style={{fontSize:12}}>A plataforma protege dados privados e libera a conversa somente após a confirmação do pagamento.</p>

          <details className="profile-report"><summary><Flag size={15} aria-hidden="true"/><span>Denunciar este perfil</span><ChevronDown className="profile-report-chevron" size={15} aria-hidden="true"/></summary>{denuncia === "enviada" && <p className="form-feedback" role="status">Denúncia enviada para análise.</p>}{denuncia === "erro" && <p className="form-error" role="alert">Descreva o problema com pelo menos 20 caracteres.</p>}<form action={reportProfileAction.bind(null, profile.id)} className="form-stack"><label className="field"><span>Motivo</span><select className="select" name="category" required><option>Foto inadequada</option><option>Informação falsa</option><option>Assédio ou comportamento abusivo</option><option>Outro</option></select></label><label className="field"><span>O que aconteceu?</span><textarea className="textarea" name="description" minLength={20} maxLength={2000} required placeholder="Explique o motivo da denúncia."/></label><button className="button button-ghost button-block" type="submit">Enviar denúncia</button></form></details>
        </aside>
      </div>
    </section>
  </PublicShell>;
}
