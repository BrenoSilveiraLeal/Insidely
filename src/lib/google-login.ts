import { createHash, randomBytes } from "node:crypto";

// Google sign-in handled by the app itself (instead of Supabase's hosted OAuth), so Google redirects
// back to this site and its account chooser reads "Prosseguir para insidely.vercel.app" (or the app
// name once the brand is verified) rather than the Supabase project address. The ID token is then
// handed to Supabase with signInWithIdToken. Needs a web OAuth client whose redirect URI is
// <APP_URL>/auth/google/callback and whose client ID is listed in Supabase → Auth → Google.
export const GOOGLE_LOGIN_COOKIE = "insidely_google_login";

export function googleLoginConfig() {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function createGoogleLoginRequest(clientId: string, redirectUri: string) {
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile",
    state, prompt: "select_account",
    // Google signs the hashed nonce into the ID token; Supabase receives the raw one and compares.
    nonce: createHash("sha256").update(nonce).digest("hex"),
  }).toString();
  return { url: url.toString(), state, nonce };
}

export async function exchangeGoogleCode(code: string, redirectUri: string, config: { clientId: string; clientSecret: string }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  const payload = await response.json() as { id_token?: string };
  if (!payload.id_token) throw new Error("Google did not return an ID token.");
  return payload.id_token;
}
