// Placeholders created by migration 20261029160000: experiences point to them while the company or
// area the consultant typed waits for review in the admin catalog queue.
export const UNLISTED_COMPANY_ID = "catalog-unlisted-company";
export const UNLISTED_PROFESSION_ID = "catalog-unlisted-profession";
export const UNLISTED_IDS = new Set([UNLISTED_COMPANY_ID, UNLISTED_PROFESSION_ID]);
export const UNLISTED_SLUGS = new Set(["empresa-nao-cadastrada", "area-nao-cadastrada"]);

export function cleanCatalogName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

// Key used to group requests: "Itaú  Unibanco" and "itau unibanco" are the same request.
export function catalogKey(value: string) {
  return cleanCatalogName(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function catalogSlug(value: string) {
  return catalogKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
}
