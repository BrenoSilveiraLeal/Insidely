import { expect, test } from "@playwright/test";

test("home expõe proposta, dados e busca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /A realidade antes da decisão/i })).toBeVisible();
  await expect(page.getByText("80", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Encontrar alguém/i }).click();
  await expect(page).toHaveURL(/\/buscar/);
  await expect(page.getByRole("heading", { name: /Encontre quem vive/i })).toBeVisible();
});

test("usuário entra e vê agenda persistida", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("demo@insidely.com");
  await page.getByLabel("Senha").fill("Demo@123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /Olá, Breno/i })).toBeVisible();
});

test("admin acessa filas de confiança", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("admin@insidely.com");
  await page.getByLabel("Senha").fill("Demo@123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.goto("/admin/verificacoes");
  await expect(page.getByRole("heading", { name: "Verificações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar" }).first()).toBeVisible();
});

