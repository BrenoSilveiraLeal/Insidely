import { describe, expect, it } from "vitest";
import { suggestEmail } from "./email-typo";

describe("suggestEmail", () => {
  it("fixes common provider typos", () => {
    expect(suggestEmail("ana@gmial.com")).toBe("ana@gmail.com");
    expect(suggestEmail("ana@hotmal.com")).toBe("ana@hotmail.com");
    expect(suggestEmail("ana@gmail.con")).toBe("ana@gmail.com");
  });

  it("leaves correct or unrelated domains alone", () => {
    expect(suggestEmail("ana@gmail.com")).toBeNull();
    expect(suggestEmail("ana@empresa.com.br")).toBeNull();
    expect(suggestEmail("sem-arroba")).toBeNull();
  });
});
