// "Trabalha lá desde 2021" / "Trabalhou lá de 2018 a 2021 · 3 anos" from the public experience
// fields ("YYYY" or "YYYY-MM", depending on what the consultant chose to show).
const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

function label(value: string) {
  const [year, month] = value.split("-");
  return month ? `${MONTHS[Number(month) - 1] ?? ""} ${year}`.trim() : year;
}

function years(start: string, end: string | null, now: Date) {
  const [sy, sm = "1"] = start.split("-").map(String);
  const [ey, em] = end ? end.split("-") : [String(now.getFullYear()), String(now.getMonth() + 1)];
  const months = (Number(ey) - Number(sy)) * 12 + (Number(em ?? "12") - Number(sm));
  if (months < 12) return months <= 1 ? "menos de 1 ano" : `${months} meses`;
  const total = Math.round(months / 12);
  return total === 1 ? "1 ano" : `${total} anos`;
}

export function experiencePeriod(exp: { isCurrent?: boolean; startedAt?: string | null; endedAt?: string | null }, now = new Date()) {
  const current = exp.isCurrent !== false;
  if (!exp.startedAt) return current ? "Trabalha lá atualmente" : "Já trabalhou lá";
  if (current) return `Trabalha lá desde ${label(exp.startedAt)} · ${years(exp.startedAt, null, now)}`;
  if (!exp.endedAt) return `Trabalhou lá a partir de ${label(exp.startedAt)}`;
  return `Trabalhou lá de ${label(exp.startedAt)} a ${label(exp.endedAt)} · ${years(exp.startedAt, exp.endedAt, now)}`;
}
