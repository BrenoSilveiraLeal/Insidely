import { ProfessionCard } from "@/components/cards";
import { PublicShell } from "@/components/public-shell";
import { getPublicProfessions } from "@/lib/queries";
export const dynamic = "force-dynamic";
export default async function ProfessionsPage() { const professions = await getPublicProfessions(); return <PublicShell><section className="page-hero" data-mark="P"><div className="container page-hero-inner"><span className="eyebrow">Profissões</span><h1>O cargo não conta o dia.</h1><p>Descubra como a rotina muda por contexto, senioridade, empresa e forma de trabalho.</p></div></section><section className="section"><div className="container"><div className="grid grid-3">{professions.map((profession)=><ProfessionCard key={profession.id} profession={profession}/>)}</div></div></section></PublicShell>; }
