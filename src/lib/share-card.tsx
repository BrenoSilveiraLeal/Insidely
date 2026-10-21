import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Link previews (WhatsApp, LinkedIn, Instagram, X) for the site and for each public page.
export const shareCardSize = { width: 1200, height: 630 };
export const shareCardType = "image/png";

const fonts = Promise.all([
  readFile(join(process.cwd(), "src/assets/nunito-800.ttf")),
  readFile(join(process.cwd(), "src/assets/nunito-600.ttf")),
]);

const clip = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export async function shareCard({ eyebrow, title, subtitle, accent = "#ff7657" }: { eyebrow: string; title: string; subtitle?: string; accent?: string }) {
  const [heavy, regular] = await fonts;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#172033", color: "#f7f2e8", fontFamily: "Nunito" }}>
      <div style={{ position: "absolute", top: -300, right: -300, width: 680, height: 680, borderRadius: 9999, background: accent, display: "flex" }} />
      <div style={{ position: "absolute", top: 70, right: 40, width: 240, height: 240, borderRadius: 9999, border: "3px solid rgba(23,32,51,.4)", display: "flex" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: "100%" }}>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 800, letterSpacing: -2 }}>insidely<span style={{ color: accent }}>.</span></div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: "#c8cfdb" }}>{clip(eyebrow, 48)}</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: title.length > 34 ? 66 : 84, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>{clip(title, 70)}</div>
          {subtitle && <div style={{ display: "flex", marginTop: 26, fontSize: 30, fontWeight: 600, lineHeight: 1.3, color: "#c8cfdb" }}>{clip(subtitle, 120)}</div>}
        </div>
      </div>
    </div>,
    { ...shareCardSize, fonts: [{ name: "Nunito", data: heavy, weight: 800, style: "normal" }, { name: "Nunito", data: regular, weight: 600, style: "normal" }] },
  );
}
