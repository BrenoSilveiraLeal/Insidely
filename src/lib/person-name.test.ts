import { describe, expect, it } from "vitest";
import { formatPersonName } from "./person-name";

describe("person name", () => {
  it("capitalises each word and keeps connectors lowercase", () => {
    expect(formatPersonName("thyago azevedo")).toBe("Thyago Azevedo");
    expect(formatPersonName("  MARIA   DA silva ")).toBe("Maria da Silva");
    expect(formatPersonName("joão dos santos e souza")).toBe("João dos Santos e Souza");
    expect(formatPersonName("ana maria d'ávila")).toBe("Ana Maria D'Ávila");
    expect(formatPersonName("jean-luc")).toBe("Jean-Luc");
    expect(formatPersonName("Casa Da Inovação São Pedro")).toBe("Casa da Inovação São Pedro");
  });
});
