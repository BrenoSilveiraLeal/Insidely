import { describe, expect, it } from "vitest";
import { detectPixKeyType, displayPixKey, maskPixKey, normalizePixKey } from "./pix-key";

describe("pix key", () => {
  it("masks CPF and phone while typing", () => {
    expect(maskPixKey("CPF", "5299822")).toBe("529.982.2");
    expect(maskPixKey("CPF", "52998224725")).toBe("529.982.247-25");
    expect(maskPixKey("PHONE", "2197354")).toBe("(21) 97354");
    expect(maskPixKey("PHONE", "21973549107")).toBe("(21) 97354-9107");
    expect(maskPixKey("PHONE", "2133334444")).toBe("(21) 3333-4444");
  });

  it("stores each type the way the Banco Central writes it", () => {
    expect(normalizePixKey("CPF", "529.982.247-25")).toBe("52998224725");
    expect(normalizePixKey("CPF", "529.982.247-24")).toBeNull();
    expect(normalizePixKey("PHONE", "(21) 97354-9107")).toBe("+5521973549107");
    expect(normalizePixKey("PHONE", "(21) 9735")).toBeNull();
    expect(normalizePixKey("EMAIL", " Ana@Email.com ")).toBe("ana@email.com");
    expect(normalizePixKey("EMAIL", "ana@email")).toBeNull();
    expect(normalizePixKey("RANDOM", "123E4567-E89B-12D3-A456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(normalizePixKey("RANDOM", "abc")).toBeNull();
  });

  it("reads back keys saved before the type was asked", () => {
    expect(detectPixKeyType("21973549107")).toBe("PHONE");
    expect(detectPixKeyType("+5521973549107")).toBe("PHONE");
    expect(detectPixKeyType("52998224725")).toBe("CPF");
    expect(detectPixKeyType("e2e@insidely.test")).toBe("EMAIL");
    expect(displayPixKey("+5521973549107")).toEqual({ type: "PHONE", text: "(21) 97354-9107" });
    expect(displayPixKey("52998224725")).toEqual({ type: "CPF", text: "529.982.247-25" });
    expect(displayPixKey(null)).toEqual({ type: "CPF", text: "" });
  });
});
