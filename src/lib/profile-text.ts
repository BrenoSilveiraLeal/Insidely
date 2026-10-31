// Public profile texts are tidied when saved, so profiles read well whatever way they were typed:
// extra spaces go, each sentence starts with a capital, odd capitals inside a word ("DEv") are
// fixed while acronyms ("UX", "RH", "SP") stay, and the presentation ends with punctuation.
// A text made of the same phrase over and over is refused instead.

const ACRONYM = /^[A-ZÀ-Ý0-9]{2,5}$/;
// Kept in capitals even when the whole text was typed in capitals.
const KNOWN = new Set(["UX", "UI", "RH", "TI", "BI", "QA", "PM", "PO", "SDR", "CEO", "CTO", "CFO", "COO", "CMO", "ERP", "CRM", "SEO", "B2B", "B2C", "SAP", "XP", "IA", "AI", "ML", "API", "SQL", "AWS", "MBA", "PJ", "CLT", "ONG", "SUS", "USP", "OAB", "CRM",
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);

function fixWord(word: string, shouting: boolean) {
  const core = word.replace(/[^\p{L}\p{N}]/gu, "");
  if (KNOWN.has(core) || (!shouting && ACRONYM.test(core))) return word;
  const letters = word.replace(/[^\p{L}]/gu, "");
  // Mixed case like "DEv" or "dEV": lower it; deliberate forms like "iFood" or "McDonald" stay.
  const upper = (letters.match(/\p{Lu}/gu) ?? []).length;
  if (upper >= 2 && upper < letters.length && /^\p{Lu}{2}/u.test(letters)) return word.toLocaleLowerCase("pt-BR");
  if (letters.length > 1 && letters === letters.toLocaleUpperCase("pt-BR")) return word.toLocaleLowerCase("pt-BR");
  return word;
}

// Mostly capital letters: the text was typed with caps lock on.
function isShouting(text: string) {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return letters.length >= 6 && (letters.match(/\p{Lu}/gu) ?? []).length / letters.length > 0.7;
}

function capitalize(text: string) {
  return text.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, start: string, letter: string) => start + letter.toLocaleUpperCase("pt-BR"));
}

export function tidyHeadline(raw: string) {
  const shouting = isShouting(raw);
  const words = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean).map((word) => fixWord(word, shouting));
  return capitalize(words.join(" ")).replace(/[.\s]+$/, "");
}

export function tidyPresentation(raw: string) {
  const text = capitalize(raw.trim().replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").split(" ").map((word) => fixWord(word, isShouting(raw))).join(" "));
  return text && !/[.!?…)]$/.test(text) ? `${text}.` : text;
}

// The same phrase (2 to 6 words) making up most of the text, e.g. "Era devops Era devops Era devops".
export function isRepetitive(raw: string) {
  const words = raw.toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  for (let size = 1; size <= 6; size++) {
    const counts = new Map<string, number>();
    for (let index = 0; index + size <= words.length; index += 1) {
      const key = words.slice(index, index + size).join(" ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const top = Math.max(...counts.values());
    if (top >= 3 && (top * size) / words.length >= 0.6) return true;
  }
  return new Set(words).size / words.length < 0.35;
}
