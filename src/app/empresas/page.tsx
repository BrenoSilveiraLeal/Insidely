import { CompanyCard } from "@/components/cards";
import { PublicShell } from "@/components/public-shell";
import { getPublicCompanies } from "@/lib/queries";
export const dynamic = "force-dynamic";
export default async function CompaniesPage() { const companies = await getPublicCompanies(); return <PublicShell><section className="page-hero" data-mark="E"><div className="container page-hero-inner"><span className="eyebrow">Empresas</span><h1>Uma marca. Muitas realidades.</h1><p>Encontre profissionais com experiência contextualizada em diferentes áreas, momentos e equipes.</p></div></section><section className="section"><div className="container"><div className="grid grid-4">{companies.map((company)=><CompanyCard key={company.id} company={company}/>)}</div></div></section></PublicShell>; }
