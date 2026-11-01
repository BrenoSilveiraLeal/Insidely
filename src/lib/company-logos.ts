import { catalogSlug } from "./catalog";

// Logos of the catalog companies, served from public/companies. A company without a file here (new
// ones approved in the admin catalog) keeps the letters tile (logoText).
const FILES: Record<string, string> = {
  accenture: "accenture.svg", amazon: "amazon.svg", ambev: "ambev.svg", drogasil: "drogasil.svg", globo: "globo.png",
  google: "google.png", ibm: "ibm.svg", ifood: "ifood.png", localiza: "localiza.svg", "magazine-luiza": "magazine-luiza.svg",
  mcdonalds: "mcdonalds.svg", "mercado-livre": "mercado-livre.png", nubank: "nubank.png", petrobras: "petrobras.svg",
  picpay: "picpay.png", renner: "renner.png", stone: "stone.png", totvs: "totvs.png", vale: "vale.png", xp: "xp.svg",
};
const WORDMARKS = new Set(["accenture", "amazon", "ambev", "drogasil", "ibm", "localiza", "magazineluiza", "petrobras"]);
const EDGE_TO_EDGE = new Set(["ifood", "renner", "xp"]);

// Experiences carry only the company name, so the lookup also accepts it ("McDonald’s" → mcdonalds).
const BY_KEY = new Map(Object.entries(FILES).map(([slug, file]) => [slug.replace(/-/g, ""), `/companies/${file}`]));

export function companyLogo(slugOrName: string | null | undefined) {
  return BY_KEY.get(catalogSlug(slugOrName ?? "").replace(/-/g, "")) ?? null;
}

export function companyLogoNeedsInset(slugOrName: string | null | undefined) {
  return WORDMARKS.has(catalogSlug(slugOrName ?? "").replace(/-/g, ""));
}

export function companyLogoBleeds(slugOrName: string | null | undefined) {
  return EDGE_TO_EDGE.has(catalogSlug(slugOrName ?? "").replace(/-/g, ""));
}
