import { redirect } from "next/navigation";

// Conversations are chats only: the customer's list lives in Mensagens. Old links land there.
export default function AppointmentsPage() {
  redirect("/dashboard/mensagens");
}
