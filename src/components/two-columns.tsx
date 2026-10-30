import { Children, type ReactNode } from "react";

// Two-column card grid: cards side by side share the row height, so every pair lines up.
// On phones it becomes a single column.
export function TwoColumns({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`two-columns ${className}`}>
    {Children.toArray(children).map((item, index) => <div className="two-columns-item" key={index}>{item}</div>)}
  </div>;
}
