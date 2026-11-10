import Link from "next/link";
import { BookingStatus, Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { WelcomeTour } from "@/components/welcome-tour";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { shortDate } from "@/lib/format";

export const metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const data = await getViewerDashboard(user.id);
  if (!data) return null;
  // Open chats (paid and not closed yet).
  const open = data.customerBookings.filter((booking) => booking.status === BookingStatus.CONFIRMED && booking.format === "MESSAGE");

  return <DashboardShell mode="user" title={`Olá, ${data.name.split(" ")[0]}.`} canConsultant={user.role === Role.CONSULTANT}><WelcomeTour kind="customer"/>
    <div className="grid grid-3"><div className="metric"><span>Chats abertos</span><strong>{open.length}</strong></div><div className="metric"><span>Perfis salvos</span><strong>{data.favorites.length}</strong></div><div className="metric"><span>Total de conversas</span><strong>{data.customerBookings.length}</strong></div></div>
    <section className="section" style={{ paddingBottom: 0 }}><div className="section-head"><div><span className="eyebrow">Mensagens</span><h2>Chats abertos</h2></div><Link className="button button-dark" href="/buscar">Encontrar profissional</Link></div><div className="list">{open.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.professional.user.name}</strong><p className="muted">Aberto em {shortDate(booking.startsAt)} · até {shortDate(new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000))}</p></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="status">Aberto</span><Link className="button button-accent button-sm" href={`/conversa/${booking.id}`}>Abrir chat</Link></div></div>)}{!open.length && <div className="panel">Nenhum chat aberto. Explore os perfis e abra um chat com quem você quer ouvir.</div>}</div></section>
    {user.role === Role.USER && <section className="section" style={{ paddingBottom: 0 }}><div className="panel become-consultant"><div><span className="eyebrow">Mesma conta</span><h2>Quer compartilhar sua experiência também?</h2><p className="muted">Crie um perfil de consultor sem abrir outra conta. Você continua conversando como cliente e alterna entre os dois modos pelo menu. Se quiser, use o modo anônimo para não ser identificado.</p></div><Link className="button button-accent" href="/dashboard/virar-consultor">Virar consultor</Link></div></section>}
  </DashboardShell>;
}
