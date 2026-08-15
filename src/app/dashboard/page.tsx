import Link from "next/link";
import { BookingStatus, Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { shortDate } from "@/lib/format";
export const dynamic="force-dynamic";
export default async function Dashboard(){const user=await requireUser([Role.USER,Role.ADMIN]);const data=await getViewerDashboard(user.id);if(!data)return null;const upcoming=data.customerBookings.filter(b=>b.status===BookingStatus.CONFIRMED&&b.startsAt>new Date());return <DashboardShell mode="user" title={`Olá, ${data.name.split(" ")[0]}.`}><div className="grid grid-3"><div className="metric"><span>Próximas conversas</span><strong>{upcoming.length}</strong></div><div className="metric"><span>Perfis salvos</span><strong>{data.favorites.length}</strong></div><div className="metric"><span>Total de conversas</span><strong>{data.customerBookings.length}</strong></div></div><section className="section" style={{paddingBottom:0}}><div className="section-head"><div><span className="eyebrow">Agenda</span><h2>Próximos encontros</h2></div><Link className="button button-dark" href="/buscar">Encontrar profissional</Link></div><div className="list">{upcoming.map(b=><div className="list-row" key={b.id}><div><strong>{b.professional.user.name}</strong><p className="muted">{shortDate(b.startsAt)} · {b.durationMinutes} min</p></div><span className="status">Confirmada</span></div>)}{!upcoming.length&&<div className="panel">Nenhuma conversa futura. Explore os perfis e escolha um horário.</div>}</div></section></DashboardShell>}

