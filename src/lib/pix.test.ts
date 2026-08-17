import { describe, expect, it } from "vitest";
import { directPixPayload } from "./pix";

describe("Pix MVP payload", () => {
  it("normalizes merchant data and returns a BR code", () => {
    const payload = directPixPayload({
      key: "pix@example.com",
      name: "João da Silva",
      city: "São Paulo",
      amount: 125,
    });

    expect(payload).toMatch(/^000201/);
    expect(payload).toContain("pix@example.com");
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });
});
