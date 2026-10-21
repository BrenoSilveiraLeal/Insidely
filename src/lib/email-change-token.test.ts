import { beforeAll, describe, expect, it } from "vitest";
import { createEmailChangeToken, readEmailChangeToken } from "./email-change-token";

describe("email change token", () => {
  beforeAll(() => { process.env.EMAIL_CHANGE_SECRET = "test-secret"; });
  const claim = { uid: "u1", from: "old@example.com", to: "new@example.com" };

  it("round-trips a valid token", () => {
    expect(readEmailChangeToken(createEmailChangeToken(claim))).toMatchObject(claim);
  });

  it("rejects tampered and expired tokens", () => {
    const token = createEmailChangeToken(claim);
    const [data, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...claim, to: "attacker@example.com", exp: Date.now() + 1e6 })).toString("base64url");
    expect(readEmailChangeToken(`${forged}.${signature}`)).toBeNull();
    expect(readEmailChangeToken(`${data}.x${signature}`)).toBeNull();
    expect(readEmailChangeToken(token, Date.now() + 2 * 60 * 60 * 1000)).toBeNull();
  });
});
