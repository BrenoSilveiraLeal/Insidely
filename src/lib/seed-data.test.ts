import { describe, expect, it } from "vitest";
import { companySeed, generateProfessionals, professionSeed } from "../../prisma/seed-data";

describe("catálogo demonstrativo", () => {
  it("gera exatamente 80 profissionais com e-mails únicos", () => {
    const people = generateProfessionals(80);
    expect(people).toHaveLength(80);
    expect(new Set(people.map((person) => person.email)).size).toBe(80);
    expect(people[0].email).toBe("consultor@insidely.com");
  });

  it("distribui profissionais por empresas, profissões e modos de privacidade", () => {
    const people = generateProfessionals(80);
    expect(new Set(people.map((person) => person.companySlug)).size).toBeGreaterThanOrEqual(15);
    expect(new Set(people.map((person) => person.professionSlug)).size).toBeGreaterThanOrEqual(15);
    expect(new Set(people.map((person) => person.privacyMode))).toEqual(new Set(["PUBLIC", "PROTECTED", "PSEUDONYM"]));
  });

  it("mantém o catálogo mínimo solicitado", () => {
    expect(companySeed.length).toBeGreaterThanOrEqual(20);
    expect(professionSeed.length).toBeGreaterThanOrEqual(25);
  });
});
