import { redirect } from "next/navigation";

// Conversations are chat only: the page of a conversation is its chat. Old links land there.
export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/conversa/${id}`);
}
