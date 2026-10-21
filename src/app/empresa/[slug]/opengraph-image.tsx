import { getCompanyBySlug } from "@/lib/queries";
import { shareCard, shareCardSize, shareCardType } from "@/lib/share-card";

export const alt = "Empresa na Insidely";
export const size = shareCardSize;
export const contentType = shareCardType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const company = await getCompanyBySlug((await params).slug).catch(() => null);
  return shareCard({ eyebrow: company?.sector || "Por dentro das empresas", title: company ? `Como é trabalhar na ${company.name}?` : "A mesma marca. Muitas realidades.", subtitle: "Converse com quem trabalha ou trabalhou lá." });
}
