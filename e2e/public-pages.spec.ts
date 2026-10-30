import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Public pages: each one loads, has a title and a main heading, and has no serious or critical
// WCAG 2.1 A/AA problem found by axe. Runs without signing in.
const PAGES = ["/", "/buscar", "/empresas", "/profissoes", "/reality-check", "/seguranca", "/ajuda", "/termos", "/privacidade", "/sobre", "/entrar", "/cadastro", "/recuperar-senha"];

for (const path of PAGES) {
  test(`página pública ${path} carrega e é acessível`, async ({ page }) => {
    // Entrance animations are skipped (as for visitors who ask the system for less motion), so the
    // contrast check sees the final colors instead of a card halfway through fading in.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status(), `status de ${path}`).toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
    // On phones the sign-in pages hide the decorative panel that holds the h1; the form heading stays.
    await expect(page.locator("h1:visible, h2:visible").first()).toBeVisible();
    // Color contrast is checked by src/lib/contrast.test.ts on the design tokens: axe misreads the
    // background of text below the fold on these pages (reports navy where the page is beige).
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).disableRules(["color-contrast"]).exclude(".cookie-banner").analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(blocking.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length}x) ${violation.nodes.slice(0, 2).map((node) => node.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}

test("perfil público abre a partir da busca", async ({ page }) => {
  await page.goto("/buscar");
  const firstProfile = page.locator('a[href^="/profissional/"]').first();
  if (!(await firstProfile.count())) test.skip(true, "nenhum perfil público cadastrado");
  await firstProfile.click();
  await expect(page).toHaveURL(/\/profissional\//);
  await expect(page.locator("h1").first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".cookie-banner").analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
});

test("áreas privadas pedem login", async ({ page }) => {
  for (const path of ["/dashboard", "/consultor", "/admin", "/dashboard/mensagens"]) {
    await page.goto(path);
    await expect(page, `${path} sem login`).toHaveURL(/\/entrar/);
  }
});
