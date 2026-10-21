import type { User } from "@supabase/supabase-js";

// Google-only accounts start without a password. Once they create one (settings or recovery), the
// server marks app_metadata.has_password, which only the service role can write.
export function accountHasPassword(user: Pick<User, "app_metadata">) {
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  return !providers.length || providers.includes("email") || user.app_metadata?.has_password === true;
}
