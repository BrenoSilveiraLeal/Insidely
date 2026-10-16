import { redirect } from "next/navigation";
export const metadata = { title: "Verificação" };
export default function Page() { redirect("/consultor/perfil#verificacao"); }
