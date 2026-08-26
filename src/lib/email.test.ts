import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "./email";

describe("Resend adapter", () => {
  const previous = process.env.E2E_MOCK_EXTERNALS;

  afterEach(() => {
    process.env.E2E_MOCK_EXTERNALS = previous;
    vi.restoreAllMocks();
  });

  it("does not call the network in external mock mode", async () => {
    process.env.E2E_MOCK_EXTERNALS = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(sendTransactionalEmail({ to: "e2e@example.test", subject: "Teste", html: "<p>ok</p>" })).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
