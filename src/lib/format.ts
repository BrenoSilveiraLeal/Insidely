export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function shortDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(date));
}

export function dateTimeInBrazil(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(date));
}

export function bookingCountdown(date: Date | string, now = new Date()) {
  const target = new Date(date);
  if (target <= now) return "Expirado";
  const dayKey = (value: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day"));
  };
  const days = Math.round((dayKey(target) - dayKey(now)) / 86_400_000);
  if (days === 0) return `Hoje · ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(target)}`;
  if (days === 1) return "Amanhã";
  return `Daqui a ${days} dias`;
}

export function publicName(profile: { privacyMode: string; pseudonym: string | null; user: { name: string } }) {
  return profile.user.name || profile.pseudonym || "Pessoa da comunidade";
}

export function initials(value: string) {
  return value.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}


export function meetingRoomOpeningText(startsAt: Date | string) {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).formatToParts(new Date(startsAt));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "--";
  return `A sala abre às ${part("hour")}:${part("minute")} de ${part("day")}/${part("month")} (10 min antes).`;
}

export function bookingStatusLabel(status: string) {
  return ({ PENDING_PAYMENT: "Aguardando pagamento", CONFIRMED: "Confirmada", AWAITING_CONFIRMATION: "Aguardando confirmação", COMPLETED_RELEASE_PENDING: "Concluída – repasse pendente", COMPLETED: "Concluída", CANCELLED: "Cancelada", EXPIRED: "Expirada", DISPUTED: "Em disputa", NO_SHOW: "Não compareceu" } as Record<string, string>)[status] ?? status;
}

// Postgres "timestamp without time zone" columns hold UTC but serialize without an offset;
// read them as UTC so dates don't shift with the server's or browser's time zone.
export function parseDbDate(value: string | Date) {
  if (value instanceof Date) return value;
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(value) || !/\d{2}:\d{2}/.test(value) ? value : value.replace(" ", "T") + "Z");
}
