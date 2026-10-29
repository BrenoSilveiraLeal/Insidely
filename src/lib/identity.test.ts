import { describe, expect, it } from "vitest";
import { ageOn, formatCpf, isValidCpf, maskCpf } from "./identity";

describe("customer identity", () => {
  it("validates CPF check digits", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234")).toBe(false);
  });

  it("formats and masks the CPF", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
  });

  it("computes the age on a given day", () => {
    expect(ageOn("2008-10-30", new Date(2026, 9, 29))).toBe(17);
    expect(ageOn("2008-10-29", new Date(2026, 9, 29))).toBe(18);
  });
});
