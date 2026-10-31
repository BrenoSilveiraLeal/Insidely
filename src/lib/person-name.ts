// People's names are stored with each word capitalised ("thyago azevedo" → "Thyago Azevedo"),
// keeping Portuguese connectors lowercase in the middle ("Maria da Silva", "João dos Santos")
// and the other letters as typed after the first ("McDonald", "D'Ávila" stay readable).
const CONNECTORS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del", "van", "von"]);

export function formatPersonName(raw: string) {
  const words = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return words.map((word, index) => {
    const lower = word.toLocaleLowerCase("pt-BR");
    if (index > 0 && index < words.length - 1 && CONNECTORS.has(lower)) return lower;
    // All caps or all lowercase words are normalised; mixed case ("McDonald") is kept.
    const base = word === word.toLocaleUpperCase("pt-BR") || word === lower ? lower : word;
    return base.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase("pt-BR"));
  }).join(" ");
}
