import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, MapPin, ShieldCheck, Star } from "lucide-react";
import { initials, money, publicName } from "@/lib/format";

type ProfileCardData = {
  id: string; headline: string; location: string; workMode: string; price30Cents: number; privacyMode: string; pseudonym: string | null; verificationStatus: string;
  user: { name: string }; experiences: { company: { name: string }; profession: { name: string } }[]; reviews: { rating: number }[];
};

export function ProfessionalCard({ profile, index = 0 }: { profile: ProfileCardData; index?: number }) {
  const name = publicName(profile); const rating = profile.reviews.length ? profile.reviews.reduce((sum, item) => sum + item.rating, 0) / profile.reviews.length : null;
  const accents = ["var(--blue)", "var(--amber)", "var(--pink)", "var(--mineral)"];
  return <Link href={`/profissional/${profile.id}`} className="card professional-card" style={{ "--card-accent": accents[index % accents.length] } as React.CSSProperties}>
    <div className="avatar-zone"><span className="avatar">{initials(name)}</span></div>
    <div className="card-body" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="card-meta">{profile.verificationStatus === "VERIFIED" && <span className="badge"><ShieldCheck size={13}/> Verificado</span>}<span className="badge">{profile.workMode === "REMOTE" ? "Remoto" : profile.workMode === "HYBRID" ? "Híbrido" : "Presencial"}</span></div>
      <h3>{name}</h3><span className="muted">{profile.headline}</span>
      <div className="card-meta"><span className="badge"><BriefcaseBusiness size={12}/>{profile.experiences[0]?.company.name}</span><span className="badge"><MapPin size={12}/>{profile.location}</span></div>
      <div className="card-footer"><span><strong>{money(profile.price30Cents)}</strong> / 30 min</span><span className="rating">{rating ? <><Star size={14} fill="currentColor"/> {rating.toFixed(1)}</> : "Novo"}</span></div>
    </div>
  </Link>;
}

export function CompanyCard({ company }: { company: { slug: string; name: string; sector: string; logoText: string; color: string; _count: { experiences: number } } }) {
  return <Link href={`/empresa/${company.slug}`} className="card company-card"><span className="logo-tile" style={{ background: company.color }}>{company.logoText}</span><div><h3>{company.name}</h3><p className="muted">{company.sector}</p><span className="count">{company._count.experiences} experiências <ArrowUpRight size={14}/></span></div></Link>;
}

export function ProfessionCard({ profession }: { profession: { slug: string; name: string; category: string; accent: string; _count: { experiences: number } } }) {
  return <Link href={`/profissao/${profession.slug}`} className="card profession-card" style={{ background: profession.accent }}><span className="eyebrow">{profession.category}</span><div><h3>{profession.name}</h3><span className="count">{profession._count.experiences} profissionais <ArrowUpRight size={14}/></span></div></Link>;
}

