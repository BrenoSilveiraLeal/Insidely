import type { CompletenessItem } from "@/lib/consultant-insights";

// "Perfil completo": progress plus what is still missing, each with how to fix it.
export function ProfileCompleteness({ percent, items }: { percent: number; items: CompletenessItem[] }) {
  if (percent >= 100) return null;
  const missing = items.filter((item) => !item.done);
  return <section className="panel completeness">
    <div className="completeness-head"><div><span className="eyebrow">Perfil completo</span><h2>{percent}% pronto</h2></div><div className="completeness-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completo"><span style={{ width: `${percent}%` }}/></div></div>
    <p className="muted">Perfis completos aparecem com mais confiança na busca e recebem mais agendamentos. {items.length - missing.length} de {items.length} itens prontos. Falta:</p>
    <ul className="completeness-list">{missing.map((item) => <li key={item.label}><a className="text-link" href={item.href}>{item.label}</a><span className="muted"> — {item.detail}</span></li>)}</ul>
  </section>;
}
