import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WCAG 2.1 contrast of the site's text/background token pairs, read from globals.css so a change of
// palette that breaks legibility fails here (4.5:1 for normal text).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const token = (name: string) => css.match(new RegExp(`--${name}:[ \\t]*(#[0-9a-fA-F]{6})`))![1];
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (light + 0.05) / (dark + 0.05); };

describe("color contrast of the design tokens", () => {
  it.each([
    ["ink", "paper"], ["ink", "paper-2"], ["muted", "paper"], ["muted", "paper-2"], ["paper", "ink"], ["red", "paper"],
  ])("%s text on %s reaches 4.5:1", (text, background) => {
    expect(contrast(token(text), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("the darker orange used for small labels reaches 4.5:1 on paper", () => {
    expect(contrast("#a8402a", token("paper"))).toBeGreaterThanOrEqual(4.5);
  });
});
