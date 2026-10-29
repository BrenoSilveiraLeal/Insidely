// Moderation for the booking chat. Conversations must stay on the platform (the room, the payment
// and the dispute process depend on it), so any attempt to exchange contact details is refused,
// as are slurs, insults and threats. The checks normalize accents, leetspeak, repeated letters,
// spelled-out digits and spaced-out words, which covers the usual ways to slip a number through.
// send_message (migration 20261029130000) repeats the essential checks in the database.

export type ChatModerationResult = { allowed: true } | { allowed: false; reason: "contact" | "offensive" };

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", um: "1", uma: "1", dois: "2", duas: "2", tres: "3", quatro: "4", cinco: "5", meia: "6", seis: "6", sete: "7", oito: "8", nove: "9",
  dez: "10", onze: "11", doze: "12", treze: "13", quatorze: "14", catorze: "14", quinze: "15", dezesseis: "16", dezessete: "17", dezoito: "18", dezenove: "19",
  vinte: "20", trinta: "30", quarenta: "40", cinquenta: "50", sessenta: "60", setenta: "70", oitenta: "80", noventa: "90",
};

// Whole words (after normalization) that point to another channel or to paying outside the app.
const CONTACT_WORDS = new Set([
  "whatsapp", "whats", "whatts", "wpp", "zap", "zapzap", "zapp", "telegram", "tg", "insta", "instagram", "ig", "facebook", "fb", "messenger",
  "tiktok", "linkedin", "linkedln", "twitter", "discord", "skype", "signal", "snapchat", "kwai", "gmail", "hotmail", "outlook", "yahoo", "icloud",
  "email", "e-mail", "arroba", "pix", "celular", "telefone", "fone", "numero", "contato", "ddd", "dm", "direct", "inbox", "privado", "pv",
]);
// Common in a normal conversation by themselves; they only count after "meu", "me passa", "seu"...
const CONTEXT_ONLY = new Set(["celular", "telefone", "fone", "numero", "contato", "email", "e-mail", "pix", "privado", "pv", "direct", "inbox", "dm", "ig", "tg", "fb"]);
const CONTEXT_LEAD = /\b(?:meu|minha|me|teu|tua|seu|sua|te|nosso|passa|passar|passo|manda|mandar|mando|chama|chamar|chamo|liga|ligar|ligo|adiciona|adicionar|add|segue|seguir)\s+(?:o\s+|a\s+|no\s+|na\s+|um\s+|uma\s+)?$/;
const CONTACT_PHRASES = [
  /\bpor fora\b/, /\bfora d[ao] (?:plataforma|app|aplicativo|site|insidely)\b/, /\bsem (?:a )?(?:plataforma|taxa|insidely)\b/, /\bchave pix\b/,
  /\bme (?:chama|liga|adiciona|add|segue|procura|acha)\b/, /\bte (?:chamo|ligo|adiciono|sigo|passo meu)\b/, /\bpaga(?:r|mos)? direto\b/, /\bdireto comigo\b/,
  /\btransferencia direta\b/, /\bmeu (?:user|usuario|nick|arroba)\b/,
];
// Spaced-out or punctuated versions ("w h a t s a p p", "g.m.a.i.l") are matched on the letters-only
// text. Only long, unambiguous names: short ones like "insta" also appear inside "instalar".
const COMPACT_CONTACT = ["whatsapp", "watsapp", "whatsap", "zapzap", "telegram", "instagram", "facebook", "linkedin", "tiktok", "discord", "snapchat", "gmail", "hotmail", "outlook"];

const OFFENSIVE_WORDS = [
  "porra", "caralho", "carai", "caraio", "krl", "foda", "fodase", "foder", "fuder", "fudido", "fodido", "fodendo", "merda", "bosta", "puta", "puto", "putaria", "putinha",
  "buceta", "boceta", "xoxota", "piroca", "cu", "cuzao", "viado", "viadinho", "bicha", "sapatao", "traveco", "arrombado", "arrombada",
  "desgraca", "desgracado", "desgracada", "cacete", "pqp", "vsf", "vtnc", "tnc", "fdp", "otario", "otaria", "idiota", "imbecil", "babaca", "retardado", "retardada",
  "mongol", "cretino", "cretina", "escroto", "escrota", "vagabundo", "vagabunda", "piranha", "vadia", "corno", "corna", "safado", "safada",
  "crioulo", "neguinho", "favelado", "baitola", "punheta", "punheteiro",
];
const OFFENSIVE_PHRASES = [
  /\bfilh[oa] d[ae] puta\b/, /\bvai (?:se )?(?:fuder|foder|tomar)\b/, /\bvai a merda\b/, /\bte (?:mato|matar|pego la fora|quebro)\b/, /\bvou te (?:matar|pegar|bater|achar)\b/,
  /\bse mata\b/, /\b(?:seu|sua) (?:lixo|verme|macac[oa]|nojent[oa]|burr[oa])\b/,
];
const COMPACT_OFFENSIVE = ["fodase", "filhodaputa", "vaisefuder", "vaisefoder", "vaitomarnocu", "caralho", "arombado"];

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function decodeLeet(value: string) {
  return value.replace(/[013457@$]/g, (char) => LEET[char] ?? char);
}

function collapseRepeats(value: string) {
  return value.replace(/([a-z])\1+/g, "$1");
}

const collapsedOffensive = new Set(OFFENSIVE_WORDS.map(collapseRepeats));

function hasContactDigits(text: string, countScattered: boolean) {
  // Years ("2015-2020") are dropped so a career timeline is not mistaken for a number. Spelled-out
  // numbers become digits ("nove nove oito..."), then digit runs are measured ignoring separators:
  // eight or more digits in a row is a phone, CPF or account number.
  const digitized = text.replace(/\b(?:19|20)\d{2}\b/g, " ").split(/(\s+)/).map((token) => NUMBER_WORDS[token.replace(/[^a-z]/g, "")] ?? token).join("");
  const runs = digitized.match(/\d(?:[\s.\-()/_*+,|\\]*\d)+/g) ?? [];
  if (runs.some((run) => run.replace(/\D/g, "").length >= 8)) return true;
  // A number split across the message ("11 9... 8765 ... 4321") still adds up. Off for long profile
  // texts, where years of experience, team sizes and the like add up to many unrelated digits.
  return countScattered && (digitized.match(/\d/g) ?? []).length >= 11;
}

export function moderateChatMessage(raw: string, options: { countScatteredDigits?: boolean } = {}): ChatModerationResult {
  const text = stripAccents(raw.toLowerCase());
  const plain = decodeLeet(text).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const compact = decodeLeet(text).replace(/[^a-z]/g, "");
  const blocked = (reason: "contact" | "offensive") => ({ allowed: false, reason }) as const;

  // "ponto com" alone is ordinary Portuguese ("um ponto com o qual..."), so the spelled-out form
  // only counts at the end of the message or followed by another domain part.
  if (/https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(?:com|net|org|br|me|io|ly|gg|app|link|site|tv)\b/.test(text)) return blocked("contact");
  if (/\b(?:ponto|dot)\s+(?:com|net|org)(?:\s+(?:ponto|dot)\s+br\b|\s*$)|\b(?:ponto|dot)\s+br\b/.test(plain)) return blocked("contact");
  if (/[\w.+-]+\s*(?:@|\(at\)|\[at\])\s*[\w-]{2,}/.test(text) || /(?:^|\s)@[a-z0-9_.]{3,}/.test(text)) return blocked("contact");
  if (hasContactDigits(text, options.countScatteredDigits ?? true)) return blocked("contact");
  if (COMPACT_CONTACT.some((word) => compact.includes(word))) return blocked("contact");
  if (CONTACT_PHRASES.some((pattern) => pattern.test(plain))) return blocked("contact");
  for (const match of plain.matchAll(/[a-z]+(?:-[a-z]+)?/g)) {
    if (!CONTACT_WORDS.has(match[0])) continue;
    if (!CONTEXT_ONLY.has(match[0]) || CONTEXT_LEAD.test(plain.slice(0, match.index))) return blocked("contact");
  }

  if (OFFENSIVE_PHRASES.some((pattern) => pattern.test(plain))) return blocked("offensive");
  if (plain.split(" ").some((word) => collapsedOffensive.has(collapseRepeats(word)))) return blocked("offensive");
  const collapsedCompact = collapseRepeats(compact);
  if (COMPACT_OFFENSIVE.some((word) => collapsedCompact.includes(collapseRepeats(word)))) return blocked("offensive");

  return { allowed: true };
}

// Feedback shown above the chat after a message was refused (the ?mensagem= code of sendMessageAction).
export function chatFeedbackText(code: string) {
  if (code === "longa") return "A mensagem passou de 2.000 caracteres.";
  if (code === "ofensiva") return "Mensagem não enviada: palavrões, ofensas e ameaças não são permitidos. Tentativas repetidas são analisadas pela equipe da Insidely e podem levar ao bloqueio da conta.";
  if (code === "limite") return "Muitas mensagens em pouco tempo. Aguarde um minuto e tente novamente.";
  if (code === "erro") return "Não foi possível enviar a mensagem agora. Tente novamente.";
  return "Mensagem não enviada: por segurança, não é permitido compartilhar telefone, e-mail, links, redes sociais ou combinar pagamento por fora. A conversa e o pagamento acontecem pela Insidely, que protege os dois lados.";
}

// Public profile texts (headline, bio, experiences) follow the chat rules: no way to reach the
// consultant outside the platform and no offensive language. Returns the label of the first bad field.
export function findUnsafeProfileText(fields: [label: string, value: string][]) {
  for (const [label, value] of fields) {
    const result = value.trim() ? moderateChatMessage(value, { countScatteredDigits: false }) : { allowed: true as const };
    if (!result.allowed) return { label, reason: result.reason };
  }
  return null;
}

export function unsafeProfileTextMessage(found: { label: string; reason: "contact" | "offensive" }) {
  return found.reason === "offensive"
    ? `O campo "${found.label}" tem palavrões ou ofensas. Revise o texto para salvar.`
    : `O campo "${found.label}" parece ter telefone, e-mail, link ou rede social. Contatos não podem aparecer no perfil: a conversa e o pagamento acontecem pela Insidely.`;
}
