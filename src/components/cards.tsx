import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, MapPin, ShieldCheck, Star } from "lucide-react";
import { initials, money, publicName } from "@/lib/format";
import { isNewProfile } from "@/lib/profile-age";
import { getIdentityVerifiedProfileIds } from "@/lib/profile-signals";

type ProfileCardData = {
  id: string; headline: string; location: string; workMode: string; price30Cents: number; privacyMode: string; pseudonym: string | null; verificationStatus: string;
  user: { name: string; image: string | null }; privacy: { showPhoto: boolean } | null; experiences: { company: { name: string }; profession: { name: string } }[]; reviews: { rating: number }[];
};

export async function ProfessionalCard({ profile, index = 0 }: { profile: ProfileCardData; index?: number }) {
  const isNew = await isNewProfile(profile.id);
  const identityVerified = (await getIdentityVerifiedProfileIds()).has(profile.id);
  const name = publicName(profile); const rating = profile.reviews.length ? profile.reviews.reduce((sum, item) => sum + item.rating, 0) / profile.reviews.length : null; const photo = profile.privacy?.showPhoto ? profile.user.image : null;
  const accents = ["var(--blue)", "var(--amber)", "var(--pink)", "var(--mineral)"];
  const verificationLabel = profile.verificationStatus === "VERIFIED" ? "Vínculo verificado" : profile.verificationStatus === "PENDING" ? "Verificação em análise" : profile.verificationStatus === "REJECTED" ? "Comprovante não aprovado" : "Sem comprovante";
  return <Link href={`/profissional/${profile.id}`} className="card professional-card" style={{ "--card-accent": accents[index % accents.length] } as React.CSSProperties}>
    <div className="avatar-zone"><span className={`avatar${photo ? " avatar-photo" : ""}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>{photo ? null : initials(name)}</span></div>
    <div className="card-body" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="card-meta"><span className={`badge${profile.verificationStatus === "VERIFIED" ? "" : " badge-unverified"}`}>{profile.verificationStatus === "VERIFIED" ? <ShieldCheck size={13}/> : null}{verificationLabel}</span>{isNew && <span className="badge badge-new">Novo</span>}{identityVerified && <span className="badge" title="CPF registrado na Insidely"><ShieldCheck size={12}/> ID verificado</span>}<span className="badge">{profile.workMode === "REMOTE" ? "Remoto" : profile.workMode === "HYBRID" ? "Híbrido" : "Presencial"}</span></div>
      <h3>{name}</h3><span className="muted">{profile.headline}</span>
      <div className="card-meta"><span className="badge"><BriefcaseBusiness size={12}/>{profile.experiences[0]?.company.name}</span><span className="badge"><MapPin size={12}/>{profile.location}</span></div>
      <div className="card-footer"><span><strong>{money(profile.price30Cents)}</strong> / 30 min</span><span className="rating">{rating ? <><Star size={14} fill="currentColor"/> {rating.toFixed(1)}</> : <span className="muted">Sem avaliações</span>}</span></div>
    </div>
  </Link>;
}

// Company colors come from the catalog: white text on dark ones, navy (or black) on light ones (WCAG 4.5:1).
function readableOn(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!match) return "#ffffff";
  const channel = (index: number) => { const value = parseInt(match[1].slice(index, index + 2), 16) / 255; return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  if (1.05 / (luminance + 0.05) >= 4.5) return "#ffffff";
  // Mid-tone colors (e.g. a bright red) reach 4.5:1 only with black.
  return (luminance + 0.05) / (0.0112 + 0.05) >= 4.5 ? "#172033" : "#000000";
}

export function CompanyCard({ company }: { company: { slug: string; name: string; sector: string; logoText: string; color: string; _count: { experiences: number } } }) {
  return <Link href={`/empresa/${company.slug}`} className="card company-card"><span className="logo-tile" style={{ background: company.color, color: readableOn(company.color) }}>{company.logoText}</span><div><h3>{company.name}</h3><p className="muted">{company.sector}</p><span className="count">{company._count.experiences} experiências <ArrowUpRight size={14}/></span></div></Link>;
}

export function ProfessionCard({ profession }: { profession: { slug: string; name: string; category: string; accent: string; _count: { experiences: number } } }) {
  return <Link href={`/profissao/${profession.slug}`} className="card profession-card" style={{ background: profession.accent }}><span className="eyebrow">{profession.category}</span><div><h3>{profession.name}</h3><span className="count">{profession._count.experiences} profissionais <ArrowUpRight size={14}/></span></div></Link>;
}
