import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
export function PublicShell({ children }: { children: React.ReactNode }) {
  return <>
    <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
    <SiteHeader/>
    <main className="site-main" id="conteudo-principal">{children}</main>
    <SiteFooter/>
  </>;
}

