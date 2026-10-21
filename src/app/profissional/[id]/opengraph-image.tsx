import { getProfessional } from "@/lib/queries";
import { publicName } from "@/lib/format";
import { shareCard, shareCardSize, shareCardType } from "@/lib/share-card";

export const alt = "Perfil profissional na Insidely";
export const size = shareCardSize;
export const contentType = shareCardType;

// Uses only what the public profile already shows (public name respects the privacy settings).
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfessional((await params).id).catch(() => null);
  if (!profile) return shareCard({ eyebrow: "Perfil profissional", title: "Converse com quem vive a realidade." });
  return shareCard({ eyebrow: profile.verificationStatus === "VERIFIED" ? "Experiência verificada" : "Perfil profissional", title: publicName(profile), subtitle: profile.headline });
}
