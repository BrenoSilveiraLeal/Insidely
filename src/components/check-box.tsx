import type { InputHTMLAttributes, ReactNode, Ref } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & { children: ReactNode; ref?: Ref<HTMLInputElement> };

/** Branded checkbox: a real native input (keyboard, forms, screen readers) drawn as a custom box. */
export function CheckBox({ children, className, ref, ...input }: Props) {
  return <label className={className ? `check-row ${className}` : "check-row"}>
    <input ref={ref} type="checkbox" className="check-input" {...input} />
    <span className="check-box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span>
    <span className="check-label">{children}</span>
  </label>;
}
