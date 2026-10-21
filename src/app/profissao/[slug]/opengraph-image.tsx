import { getProfessionBySlug } from "@/lib/queries";
import { shareCard, shareCardSize, shareCardType } from "@/lib/share-card";

export const alt = "Profissão na Insidely";
export const size = shareCardSize;
export const contentType = shareCardType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const profession = await getProfessionBySlug((await params).slug).catch(() => null);
  return shareCard({ eyebrow: profession?.category || "Rotinas por área", title: profession ? `A rotina real de ${profession.name}` : "A profissão, como ela é.", subtitle: "Compare a ideia que você tem com a prática de quem está na área." });
}
