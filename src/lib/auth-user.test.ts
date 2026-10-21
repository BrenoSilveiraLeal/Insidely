import { describe, expect, it } from "vitest";
import { accountHasPassword } from "./auth-user";

describe("accountHasPassword", () => {
  it("is true for e-mail accounts", () => expect(accountHasPassword({ app_metadata: { providers: ["email", "google"] } })).toBe(true));
  it("is false for Google-only accounts", () => expect(accountHasPassword({ app_metadata: { providers: ["google"] } })).toBe(false));
  it("is true once a Google account created a password", () => expect(accountHasPassword({ app_metadata: { providers: ["google"], has_password: true } })).toBe(true));
});
