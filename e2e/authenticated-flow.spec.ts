import Stripe from "stripe";
import { expect, test } from "@playwright/test";
import { cleanAuthenticatedFlow, authenticatedE2EEnabled, seedAuthenticatedFlow, serviceClient, type E2EAccount, type E2EState } from "./authenticated-flow.fixture";

type BookingSnapshot = { status: string; customerConfirmedAt: string | null; consultantConfirmedAt: string | null; meetingUrl: string | null; payment: { status: string; stripeTransferId: string | null }; attempts: Array<{ status: string; attemptCount: number }> };

test.describe.configure({ mode: "serial" });

test.describe("fluxo autenticado cliente + consultor", () => {
  test.skip(!authenticatedE2EEnabled, "Defina E2E_SUPABASE_SERVICE_ROLE_KEY para executar o E2E autenticado em um banco de teste isolado.");

  let state: E2EState;

  test.beforeAll(async () => {
    state = await seedAuthenticatedFlow();
  });

  test.afterAll(async () => {
    if (state) await cleanAuthenticatedFlow(state);
  });

  async function login(page: import("@playwright/test").Page, account: E2EAccount) {
    await page.goto("/entrar");
    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForTimeout(250);
    const alert = page.locator("form.auth-form [role=alert]").first();
    if (await alert.isVisible().catch(() => false)) {
      const message = (await alert.innerText()).trim();
      if (message) throw new Error(`Login failed for ${account.name}: ${message} (url=${page.url()})`);
    }
    await expect(page).toHaveURL(/\/(dashboard|consultor|continuar)/, { timeout: 15_000 });
    if (page.url().endsWith("/continuar")) await expect(page).toHaveURL(/\/(dashboard|consultor)/);
  }

  async function readBooking() {
    const client = serviceClient();
    const { data, error } = await client.from("Booking").select("id,status,startsAt,customerConfirmedAt,consultantConfirmedAt,disputedAt,meetingUrl,payment:Payment(status,stripeTransferId),attempts:TransferAttempt(status,attemptCount)").eq("id", state.bookingId!).single();
    if (error || !data) throw new Error(`Could not read E2E booking: ${error?.message ?? "not found"}`);
    const row = data as unknown as { payment: BookingSnapshot["payment"] | BookingSnapshot["payment"][]; attempts: BookingSnapshot["attempts"] } & Omit<BookingSnapshot, "payment" | "attempts">;
    return { ...row, payment: Array.isArray(row.payment) ? row.payment[0] : row.payment, attempts: row.attempts ?? [] } as BookingSnapshot;
  }

  async function sendStripePaymentWebhook(request: import("@playwright/test").APIRequestContext) {
    const event = {
      id: `evt_e2e_${state.bookingId}`,
      object: "event",
      api_version: "2025-03-31.basil",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
      data: { object: { id: `cs_e2e_${state.bookingId}`, object: "checkout.session", client_reference_id: state.bookingId, mode: "payment", payment_intent: `pi_e2e_${state.bookingId}`, payment_status: "paid", metadata: { bookingId: state.bookingId, customerId: state.customer.userId } } },
    };
    const payload = JSON.stringify(event);
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2e_test_secret";
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    return request.post("/api/webhooks/stripe", { data: payload, headers: { "content-type": "application/json", "stripe-signature": signature } });
  }

  test("completa booking, pagamento, comunicação, Meet, relatório, retry e avaliação", async ({ browser, request }) => {
    const customerContext = await browser.newContext();
    const consultantContext = await browser.newContext();
    const customer = await customerContext.newPage();
    const consultant = await consultantContext.newPage();
    try {
      await login(customer, state.customer);
      await login(consultant, state.consultant);

      await test.step("cliente cria agendamento e consultor recebe solicitação", async () => {
        await customer.goto(`/agendar/${state.profileId}`);
        await customer.locator('select[name="slot"]').selectOption(state.slotId);
        await customer.locator('textarea[name="goals"]').fill("Quero entender a rotina real, a cultura e o processo de decisão.");
        await customer.getByRole("button", { name: "Continuar para o checkout" }).click();
        await expect(customer).toHaveURL(/\/checkout\/[^?]+/);
        state.bookingId = new URL(customer.url()).pathname.split("/").pop();
        expect(state.bookingId).toBeTruthy();

        await customer.goto("/dashboard/mensagens");
        await expect(customer.getByText(/Finalize o pedido/i)).toBeVisible();
        await expect(customer.locator('input[aria-label^="Mensagem"]')).toHaveCount(0);
        await consultant.goto("/consultor/consultas");
        await expect(consultant.getByText(/Pedido ainda não pago/i)).toBeVisible();
        await expect(consultant.locator('input[name="body"]')).toHaveCount(0);
      });

      await test.step("pagamento é iniciado e webhook mockado confirma", async () => {
        await customer.goto(`/checkout/${state.bookingId}`);
        await customer.getByRole("button", { name: "Pagar com Stripe" }).click();
        await expect(customer).toHaveURL(new RegExp(`/checkout/${state.bookingId}\\?status=mock_checkout_started`));
        const webhook = await sendStripePaymentWebhook(request);
        expect(webhook.ok()).toBeTruthy();
        const booking = await readBooking();
        expect(booking.status).toBe("CONFIRMED");
        expect(booking.payment.status).toBe("PAID_HELD");
      });

      await test.step("notificações, Meet mockado e cron de Meet", async () => {
        await customer.goto("/dashboard");
        await expect(customer.getByText("Pagamento confirmado")).toBeVisible();
        await consultant.goto("/consultor");
        await expect(consultant.getByText("Pagamento confirmado")).toBeVisible();
        const confirmed = await readBooking();
        expect(confirmed.meetingUrl).toBe("https://meet.google.com/e2e-insidely-room");

        const client = serviceClient();
        await client.from("Booking").update({ meetingUrl: null }).eq("id", state.bookingId!);
        const cron = await request.get("/api/cron/create-meetings", { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "e2e-cron-secret"}` } });
        expect(cron.ok()).toBeTruthy();
        expect((await cron.json()).created).toBe(1);
        expect((await readBooking()).meetingUrl).toBe("https://meet.google.com/e2e-insidely-room");
      });

      await test.step("mensagens são liberadas após pagamento", async () => {
        await customer.goto("/dashboard/mensagens");
        const message = customer.locator('input[aria-label^="Mensagem"]');
        await expect(message).toBeVisible();
        await message.fill("Vamos conversar sobre autonomia e contexto.");
        await customer.getByRole("button", { name: "Enviar" }).click();
        await consultant.goto("/consultor/consultas");
        await expect(consultant.getByText("Vamos conversar sobre autonomia e contexto.")).toBeVisible();
      });

      await test.step("cliente cria relatório de suporte", async () => {
        await customer.goto("/suporte");
        await customer.locator('select[name="category"]').selectOption("Agendamento");
        await customer.locator('textarea[name="description"]').fill("Preciso registrar uma dúvida operacional sobre este agendamento de teste.");
        await customer.getByRole("button", { name: "Enviar para o suporte" }).click();
        await expect(customer.getByText(/Mensagem enviada/)).toBeVisible();
        const client = serviceClient();
        const { data: report } = await client.from("Report").select("id,status").eq("reporterId", state.customer.userId).order("createdAt", { ascending: false }).limit(1).single();
        expect(report?.status).toBe("OPEN");
        state.reportId = report?.id;
      });

      await test.step("consultor e cliente confirmam; transferência falha e faz retry idempotente", async () => {
        const client = serviceClient();
        // Booking timestamps are stored without timezone; leave enough margin
        // for UTC/local interpretation in the browser and Postgres.
        const endedAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const releaseAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const { error: scheduleError } = await client.from("Booking").update({ startsAt: endedAt, autoReleaseAt: releaseAt }).eq("id", state.bookingId!);
        expect(scheduleError).toBeNull();
        expect((await readBooking()).status).toBe("CONFIRMED");
        await consultant.goto("/consultor/consultas");
        await consultant.getByRole("button", { name: "Informar fim da conversa" }).click({ timeout: 5000 });
        await expect.poll(async () => (await readBooking()).consultantConfirmedAt, { timeout: 10_000 }).toBeTruthy();
        await customer.goto("/dashboard/agendamentos");
        await customer.getByRole("button", { name: "Confirmar conversa realizada" }).click();
        await expect.poll(async () => (await readBooking()).customerConfirmedAt, { timeout: 10_000 }).toBeTruthy();
        await expect.poll(async () => (await readBooking()).payment.status, { timeout: 10_000 }).toBe("TRANSFER_FAILED");
        const failed = await readBooking();
        expect(failed.customerConfirmedAt).toBeTruthy();
        expect(failed.status).toBe("COMPLETED_RELEASE_PENDING");
        expect(failed.payment.status).toBe("TRANSFER_FAILED");
        expect(failed.attempts[0].status).toBe("FAILED");
        expect(failed.attempts[0].attemptCount).toBe(1);

        // Simulate the retry window elapsing without making the E2E sleep 15 minutes.
        const { error: retryWindowError } = await client.from("TransferAttempt").update({ nextRetryAt: new Date(Date.now() - 60_000).toISOString() }).eq("bookingId", state.bookingId!);
        expect(retryWindowError).toBeNull();
        const retry = await request.get("/api/cron/release-bookings", { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "e2e-cron-secret"}` } });
        expect(retry.ok()).toBeTruthy();
        expect((await retry.json()).released).toBe(1);
        const released = await readBooking();
        expect(released.status).toBe("COMPLETED");
        expect(released.payment.status).toBe("RELEASED");
        expect(released.attempts[0].status).toBe("SUCCEEDED");
        expect(released.attempts[0].attemptCount).toBe(2);
      });

      await test.step("avaliação é publicada e logout/login protege a rota", async () => {
        await customer.goto("/dashboard/avaliacoes");
        await customer.locator('textarea[name="comment"]').fill("A conversa trouxe contexto útil para decidir com mais clareza.");
        await customer.getByRole("button", { name: "Publicar avaliação" }).click();
        await expect(customer.locator(".form-feedback")).toContainText(/Avalia/);
        await customer.getByRole("button", { name: "Sair" }).click();
        await expect(customer).toHaveURL("/");
        await customer.goto("/dashboard");
        await expect(customer).toHaveURL(/\/entrar/);
        await login(customer, state.customer);
        await expect(customer).toHaveURL(/\/dashboard/);
      });
    } finally {
      await customerContext.close();
      await consultantContext.close();
    }
  });
});
