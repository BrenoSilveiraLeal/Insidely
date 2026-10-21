import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, short-lived token for confirming a new account e-mail. It is bound to the current e-mail,
// so it stops working as soon as the change happens (single use) or if the e-mail changes another way.
type Payload = { uid: string; from: string; to: string; exp: number };
const TTL_MS = 60 * 60 * 1000;

function key() {
  const secret = process.env.EMAIL_CHANGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("email_change_secret_missing");
  return createHmac("sha256", secret).update("insidely:email-change:v1").digest();
}
const sign = (data: string) => createHmac("sha256", key()).update(data).digest("base64url");

export function createEmailChangeToken({ uid, from, to }: Omit<Payload, "exp">, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ uid, from, to, exp: now + TTL_MS } satisfies Payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function readEmailChangeToken(token: string, now = Date.now()): Payload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data)), given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
    return typeof payload.uid === "string" && typeof payload.from === "string" && typeof payload.to === "string" && payload.exp > now ? payload : null;
  } catch { return null; }
}
