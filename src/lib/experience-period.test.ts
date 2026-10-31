import { describe, expect, it } from "vitest";
import { experiencePeriod } from "./experience-period";

describe("experience period", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  it("counts whole years when only the year is public", () => {
    expect(experiencePeriod({ isCurrent: true, startedAt: "2023" }, now)).toBe("Trabalha lá desde 2023 · 3 anos");
    expect(experiencePeriod({ isCurrent: false, startedAt: "2018", endedAt: "2021" }, now)).toBe("Trabalhou lá de 2018 a 2021 · 3 anos");
  });
  it("uses months when exact dates are public", () => {
    expect(experiencePeriod({ isCurrent: false, startedAt: "2020-03", endedAt: "2020-09" }, now)).toBe("Trabalhou lá de mar. 2020 a set. 2020 · 6 meses");
    expect(experiencePeriod({ isCurrent: true, startedAt: "2024-12" }, now)).toBe("Trabalha lá desde dez. 2024 · 1 ano");
  });
});
