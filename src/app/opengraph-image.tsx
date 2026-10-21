import { shareCard, shareCardSize, shareCardType } from "@/lib/share-card";

export const alt = "Insidely — A realidade antes da decisão";
export const size = shareCardSize;
export const contentType = shareCardType;

export default function Image() {
  return shareCard({ eyebrow: "A realidade antes da decisão", title: "Converse com quem vive a empresa por dentro.", subtitle: "Profissionais verificados contam a rotina real de empresas e profissões." });
}
