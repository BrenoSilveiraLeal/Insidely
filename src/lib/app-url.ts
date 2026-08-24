const productionUrl = "https://insidely.vercel.app";

export function getAppUrl(requestOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (process.env.VERCEL_ENV === "production") {
    return configured && !configured.includes("localhost") ? configured.replace(/\/$/, "") : productionUrl;
  }
  if (configured && !configured.includes("localhost")) return configured.replace(/\/$/, "");
  return requestOrigin || "http://localhost:3000";
}
