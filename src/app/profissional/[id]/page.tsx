import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, Clock, ShieldCheck, Star } from "lucide-react";
import { reportProfileAction } from "@/app/actions";
import { FavoriteButton } from "@/components/favorite-button";
import { PublicShell } from "@/components/public-shell";
import { dateTimeInBrazil, initials, money, publicName, shortDate } from "@/lib/format";
import { getFavoriteState, getProfessional } from "@/lib/queries";
import { getAuthenticatedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfessionalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ denuncia?: string }> }) {
  const { id } = await params;
  const { denuncia } = await searchParams;
  const profile = await getProfessional(id);
  if (!profile) notFound();
  const viewer = await getAuthenticatedUser();
  const isFavorite = viewer ? await getFavoriteState(profile.id, viewer.id) : false;
  const name = publicName(profile);
  const reviews = profile.reviews ?? [];
  const availability = profile.availability ?? [];
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const photo = profile.privacy?.showPhoto ? profile.user.image : null;
  const cover = profile.privacy?.showPhoto ? profile.coverImage : null;
  const verification = profile.verificationStatus === "VERIFIED"
    ? { label: "Experiência verificada", detail: "A Insiderly conferiu a comprovação profissional enviada para este perfil." }
    : profile.verificationStatus === "PENDING"
      ? { label: "Comprovação em análise", detail: "A experiência e o vínculo com a empresa foram informados pela própria pessoa e ainda estão em análise pela Insiderly." }
      : profile.verificationStatus === "MORE_INFO_REQUIRED"
        ? { label: "Comprovação incompleta", detail: "A Insiderly pediu informações adicionais. Até a conclusão da análise, a experiência e o vínculo com a empresa não estão comprovados." }
        : profile.verificationStatus === "REJECTED"
          ? { label: "Experiência não comprovada", detail: "A comprovação não foi aprovada. A experiência e o vínculo com a empresa permanecem sem validação da Insiderly." }
          : { label: "Experiência não comprovada", detail: "A experiência e o vínculo com a empresa foram declarados pela própria pessoa e ainda não foram comprovados à Insiderly." };

  return <PublicShell>
    <section className={`profile-hero${cover ? " profile-hero-with-cover" : ""}`} style={cover ? { backgroundImage: `linear-gradient(90deg, rgba(23,32,51,.9), rgba(23,32,51,.45)), url(${cover})` } : undefined}>
      <div className="container">
        <div className={`avatar${photo ? " avatar-photo" : ""}`} style={{ width: 120, fontSize: "2.4rem", ...(photo ? { backgroundImage: `url(${photo})` } : {}) }}>{photo ? null : initials(name)}</div>
        <div className="card-meta"><span className={`badge${profile.verificationStatus === "VERIFIED" ? "" : " badge-unverified"}`}>{profile.verificationStatus === "VERIFIED" && <ShieldCheck size={13}/>} {verification.label}</span><span className="badge">{profile.privacyMode === "PUBLIC" ? "Perfil público" : "Identidade protegida"}</span></div>
        <p className="verification-disclosure" role="note">{verification.detail}</p>
        <h1 className="profile-title">{name}</h1>
        <p className="section-copy">{profile.headline}</p>
      </div>
    </section>

    <section className="section">
      <div className="container profile-layout">
        <div className="grid">
          <article className="profile-main"><span className="eyebrow">Sobre a experiência</span><h2>Contexto que posso compartilhar</h2><p>{profile.bio}</p><div className="card-meta">{profile.topics.map(topic => <span className="badge" key={topic}>{topic}</span>)}</div></article>
          <article className="profile-main"><span className="eyebrow">Trajetória</span><h2>Experiência declarada</h2><ul className="detail-list">{profile.experiences.map(exp => <li key={exp.id}><div><strong>{exp.title}</strong><br/><span className="muted">{exp.profession.name} · {exp.company.name}</span></div><BriefcaseBusiness/></li>)}</ul><p className="muted">Datas exatas e histórico completo respeitam as escolhas de privacidade do consultor.</p></article>
          <article className="profile-main"><span className="eyebrow">Limites claros</span><h2>O que não entra na conversa</h2><ul>{profile.boundaries.map(item => <li key={item}>{item}</li>)}</ul></article>
          <article className="profile-main"><span className="eyebrow">{reviews.length} avaliações</span><h2>Depois das conversas</h2>{reviews.length ? <div className="list">{reviews.map(review => <div className="list-row" key={review.id}><div><strong>{review.user.name.split(" ")[0]}</strong><p>{review.comment}</p></div><span className="rating"><Star size={14} fill="currentColor"/> {review.rating}</span></div>)}</div> : <p className="muted">Este perfil ainda não recebeu uma avaliação.</p>}</article>
        </div>

        <aside className="booking-box">
          <span className="eyebrow">Conversa individual</span>
          <h2>{money(profile.price30Cents)} <small>/ 30 min</small></h2>
          <ul className="detail-list"><li><span><Star size={15}/> Avaliação</span><strong>{average ? average.toFixed(1) : "Novo"}</strong></li><li><span><Clock size={15}/> Resposta</span><strong>em até {profile.responseHours}h</strong></li><li><span><CalendarDays size={15}/> Próximo horário</span><strong>{availability[0] ? shortDate(availability[0].startsAt) : "A definir"}</strong></li></ul>

          <div className="availability-preview">
            <span className="eyebrow">Horários disponíveis · Brasília</span>
            {availability.length ? <div className="availability-preview-list">{availability.slice(0, 5).map(slot => <Link className="availability-preview-item" href={`/agendar/${profile.id}?slot=${encodeURIComponent(slot.id)}`} key={slot.id}><span>{dateTimeInBrazil(slot.startsAt)}</span><span>Escolher</span></Link>)}</div> : <p className="muted">Este perfil ainda não abriu horários para conversa.</p>}
          </div>

          {availability.length > 0 && <Link className="button button-dark button-block" href={`/agendar/${profile.id}`}>Ver todos os horários</Link>}
          <FavoriteButton profileId={profile.id} initialSaved={isFavorite}/>
          <p className="muted" style={{fontSize:12}}>A plataforma protege dados privados e libera a conversa somente após a confirmação do pagamento.</p>

          <details className="profile-report"><summary>Denunciar este perfil</summary>{denuncia === "enviada" && <p className="form-feedback" role="status">Denúncia enviada para análise.</p>}{denuncia === "erro" && <p className="form-error" role="alert">Descreva o problema com pelo menos 20 caracteres.</p>}<form action={reportProfileAction.bind(null, profile.id)} className="form-stack"><label className="field"><span>Motivo</span><select className="select" name="category" required><option>Foto inadequada</option><option>Informação falsa</option><option>Assédio ou comportamento abusivo</option><option>Outro</option></select></label><label className="field"><span>O que aconteceu?</span><textarea className="textarea" name="description" minLength={20} maxLength={2000} required placeholder="Explique o motivo da denúncia."/></label><button className="button button-ghost button-block" type="submit">Enviar denúncia</button></form></details>
        </aside>
      </div>
    </section>
  </PublicShell>;
}
