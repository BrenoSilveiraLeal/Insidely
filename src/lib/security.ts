export function safeInternalPath(raw:string|null,fallback="/continuar"){if(!raw||!raw.startsWith("/")||raw.startsWith("//")||raw.includes("\\")||raw.includes("\0"))return fallback;return raw}
export const blockedContactPattern=/(?:https?:\/\/|www\.|\b(?:whats?app|instagram|telegram|pix)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4})/i;
