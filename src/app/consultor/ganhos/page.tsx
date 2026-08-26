import { DashboardShell } from "@/components/dashboard-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { Role, PaymentStatus } from "@/lib/domain";
import { money, shortDate } from "@/lib/format";
import { getConsultantGains } from "@/lib/queries";
import { requireUser } from "@/lib/session";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){const user=await requireUser([Role.CONSULTANT]);const page=Math.max(1,Number((await searchParams).page)||1);const gains=await getConsultantGains(user.id,page,20);return <DashboardShell mode="consultant" title="Ganhos"><div className="grid grid-2" style={{marginBottom:24}}><div className="metric"><span>Repasse liberado</span><strong>{money(gains.releasedTotalCents)}</strong></div><div className="metric"><span>Valor retido em segurança</span><strong>{money(gains.heldTotalCents)}</strong></div></div><div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Seu repasse</th><th>Status</th></tr></thead><tbody>{gains.items.map(booking=><tr key={booking.id}><td>{shortDate(booking.startsAt)}</td><td>{booking.customer.name}</td><td>{money(booking.totalCents-booking.feeCents)}</td><td><span className="status">{booking.payment?.status===PaymentStatus.RELEASED?"LIBERADO":"RETIDO"}</span></td></tr>)}</tbody></table></div><PaginationControls page={gains.page} total={gains.total} pageSize={gains.pageSize} basePath="/consultor/ganhos"/></DashboardShell>}
