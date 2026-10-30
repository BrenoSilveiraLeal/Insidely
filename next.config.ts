import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.E2E_SERVER === "true" ? { distDir: ".next-e2e" } : {}),
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Revisiting a page within 30s reuses what the browser already has instead of a new server round trip.
    // Server actions still refresh the affected pages through revalidatePath.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "Permissions-Policy", value: "geolocation=(), payment=(), usb=()" },
      { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://*.supabase.co; upgrade-insecure-requests` },
    ] }];
  },
};

export default nextConfig;
