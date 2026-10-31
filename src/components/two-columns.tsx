import { Children, type ReactNode } from "react";

// Two-column card list.
// "rows" (default): cards side by side share the row height, so every pair lines up.
// "masonry": two independent columns, alternating left/right; a short card lets the next one move
// up, for lists whose cards vary a lot in height. On phones both become a single column.
export function TwoColumns({ children, className = "", layout = "rows" }: { children: ReactNode; className?: string; layout?: "rows" | "masonry" }) {
  const items = Children.toArray(children);
  if (layout === "masonry") return <div className={`two-columns two-columns-masonry ${className}`}>
    {[0, 1].map((column) => <div className="two-columns-col" key={column}>
      {items.map((item, index) => index % 2 === column ? <div className="two-columns-item" key={index} style={{ order: index }}>{item}</div> : null)}
    </div>)}
  </div>;
  return <div className={`two-columns ${className}`}>
    {items.map((item, index) => <div className="two-columns-item" key={index}>{item}</div>)}
  </div>;
}
