export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function shortDate(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

export function publicName(profile: { privacyMode: string; pseudonym: string | null; user: { name: string } }) {
  if (profile.privacyMode === "PSEUDONYM") return profile.pseudonym ?? "Profissional verificado";
  if (profile.privacyMode === "PROTECTED") return `${profile.user.name.split(" ")[0]} · identidade protegida`;
  return profile.user.name;
}

export function initials(value: string) {
  return value.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

