import { describe, expect, it } from "vitest";
import { emailText, renderEmailLayout } from "./email";

describe("e-mail layout", () => {
  const content = '<p>Olá, Ana</p><p>Falta só um passo.</p><p><a href="https://insidely.app/x" style="color:red">Confirmar</a></p>';

  it("wraps the content in the branded layout", () => {
    const html = renderEmailLayout(content);
    expect(html).toContain("insidely<span");
    expect(html).toContain("Falta só um passo.");
    expect(html).toContain('style="margin:0 0 16px');
  });

  it("builds a readable plain-text version", () => {
    expect(emailText(content)).toBe("Olá, Ana\n\nFalta só um passo.\n\nConfirmar (https://insidely.app/x)");
  });
});
