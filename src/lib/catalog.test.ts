import { describe, expect, it } from "vitest";
import { catalogKey, catalogSlug, cleanCatalogName } from "./catalog";

describe("catalog requests", () => {
  it("groups the same name typed in different ways", () => {
    expect(catalogKey("  Itaú   Unibanco ")).toBe(catalogKey("itau unibanco"));
    expect(cleanCatalogName("  Itaú   Unibanco ")).toBe("Itaú Unibanco");
  });

  it("builds URL slugs", () => {
    expect(catalogSlug("Itaú Unibanco S.A.")).toBe("itau-unibanco-s-a");
    expect(catalogSlug("???")).toBe("item");
  });
});
