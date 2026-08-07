import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
export function PublicShell({ children }: { children: React.ReactNode }) { return <><SiteHeader/><main className="site-main">{children}</main><SiteFooter/></>; }

