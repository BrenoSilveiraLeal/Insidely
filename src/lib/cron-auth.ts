import { createHash, timingSafeEqual } from "node:crypto";

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Compared in constant time (hashed first so
// both sides have the same length); with no secret configured every request is refused.
export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}
