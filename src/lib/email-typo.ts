// Suggests the intended address when the domain looks like a typo of a common provider ("gmial.com" → "gmail.com").
const knownDomains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br", "icloud.com", "live.com", "uol.com.br", "bol.com.br", "terra.com.br", "msn.com", "proton.me", "protonmail.com"];

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

export function suggestEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (knownDomains.includes(domain)) return null;
  let best: { domain: string; score: number } | null = null;
  for (const candidate of knownDomains) {
    const score = distance(domain, candidate);
    if (score <= 2 && (!best || score < best.score)) best = { domain: candidate, score };
  }
  return best ? `${email.slice(0, at)}@${best.domain}` : null;
}
