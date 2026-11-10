// Weekly hours a consultant usually answers chats (ProfessionalProfile."chatHours", migration
// 20261110100000), in Brasília time. They are information for the customer ("Costuma responder…",
// "Disponível agora"); a chat can be bought at any time.
export type ChatWindow = { day: number; start: string; end: string };

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseChatHours(value: unknown): ChatWindow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChatWindow => Boolean(item) && typeof item === "object"
    && Number.isInteger((item as ChatWindow).day) && (item as ChatWindow).day >= 0 && (item as ChatWindow).day <= 6
    && TIME.test(String((item as ChatWindow).start)) && TIME.test(String((item as ChatWindow).end)) && (item as ChatWindow).start < (item as ChatWindow).end)
    .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7) || a.start.localeCompare(b.start));
}

function brasiliaNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")), time: `${get("hour")}:${get("minute")}` };
}

export function isAvailableNow(windows: ChatWindow[], now = new Date()) {
  const { day, time } = brasiliaNow(now);
  return windows.some((window) => window.day === day && window.start <= time && time < window.end);
}

const hour = (value: string) => value.endsWith(":00") ? `${Number(value.slice(0, 2))}h` : value.replace(":", "h");

// "Seg a Sex · 19h–22h; Sáb · 10h–12h": days with the same hours are grouped.
export function describeChatHours(windows: ChatWindow[]) {
  const byHours = new Map<string, number[]>();
  for (const window of windows) {
    const key = `${hour(window.start)}–${hour(window.end)}`;
    byHours.set(key, [...(byHours.get(key) ?? []), window.day]);
  }
  return [...byHours.entries()].map(([hours, days]) => {
    const ordered = [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const positions = ordered.map((day) => (day + 6) % 7);
    const consecutive = ordered.length > 2 && positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);
    const label = consecutive ? `${WEEKDAY_LABELS[ordered[0]]} a ${WEEKDAY_LABELS[ordered[ordered.length - 1]]}` : ordered.map((day) => WEEKDAY_LABELS[day]).join(", ");
    return `${label} · ${hours}`;
  }).join("; ");
}
