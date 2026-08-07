import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { prisma } from "@/lib/prisma";
export const dynamic="force-dynamic";
export default async function RealityPage(){const items=await prisma.realityCheck.findMany({include:{profession:true}});return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Reality Check</span><h1>Expectativa encontra contexto.</h1><p>Retratos gerais, demonstrativos e sem promessas. Use-os para formular perguntas melhores.</p></div></section><section className="section"><div className="container grid grid-3">{items.map((item)=><Link key={item.id} className="card profession-card" style={{background:item.profession.accent}} href={`/reality-check/${item.profession.slug}`}><span className="eyebrow">{item.profession.category}</span><div><h3>{item.profession.name}</h3><p>{item.title}</p></div></Link>)}</div></section></PublicShell>}

