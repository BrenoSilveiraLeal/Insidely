import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Collapsible box for long settings pages (Editar perfil): a summary row with icon, title and a
// one-line hint; the fields only show when it is opened.
export function EditBox({ icon, title, hint, open, children, id }: { icon: ReactNode; title: string; hint?: string; open?: boolean; children: ReactNode; id?: string }) {
  return <details className="edit-box" open={open} id={id}>
    <summary>
      <span className="edit-box-icon" aria-hidden="true">{icon}</span>
      <span className="edit-box-text"><strong>{title}</strong>{hint && <small>{hint}</small>}</span>
      <ChevronDown className="edit-box-chevron" size={20} aria-hidden="true"/>
    </summary>
    <div className="edit-box-body">{children}</div>
  </details>;
}
