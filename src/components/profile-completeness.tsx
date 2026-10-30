import type { CompletenessItem } from "@/lib/consultant-insights";

// "Perfil completo": a slim progress bar plus the missing items as small links (detail on hover).
export function ProfileCompleteness({ percent, items }: { percent: number; items: CompletenessItem[] }) {
  if (percent >= 100) return null;
  const missing = items.filter((item) => !item.done);
  return <section className="panel completeness" aria-label="Perfil completo">
    <div className="completeness-head"><span className="completeness-label">Perfil <strong>{percent}%</strong> completo</span><div className="completeness-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completo"><span style={{ width: `${percent}%` }}/></div><span className="completeness-count">{items.length - missing.length}/{items.length}</span></div>
    <div className="completeness-missing"><span>Falta:</span>{missing.map((item) => <a key={item.label} className="completeness-chip" href={item.href} title={item.detail}>{item.label}</a>)}</div>
  </section>;
}
