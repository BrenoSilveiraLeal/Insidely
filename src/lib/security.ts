export function safeInternalPath(raw: string | null, fallback = "/continuar") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\0")) return fallback;
  return raw;
}

export const blockedContactPattern = /(?:https?:\/\/|www\.|\b(?:whats?app|instagram|telegram|pix)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4})/i;

const profanityPattern = /\b(?:porra|caralho|c[a\u00e3]ralho|foda(?:-se)?|fodendo|merda|bosta|puta|puto|buceta|cu|viado|arrombado|desgra[c\u00e7]a|cacete|pqp|vsf)\b/giu;
const contactPatterns = [
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu,
  /(?:https?:\/\/|www\.)\S+/giu,
  /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-.\s]?\d{4}/gu,
  /(?:@|\b)(?:instagram|insta|whatsapp|whats|telegram|tiktok|linkedin)\s*[:/]?\s*@?[\w.-]*/giu,
];

/** Masks profanity and direct contact details before a booking goal is stored or shown. */
export function maskUnsafeGoal(value: string) {
  let masked = value.replace(profanityPattern, (word) => "*".repeat(Math.max(3, word.length)));
  for (const pattern of contactPatterns) masked = masked.replace(pattern, (match) => "*".repeat(Math.max(3, match.length)));
  return masked;
}
