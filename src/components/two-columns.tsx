import { Children, type ReactNode } from "react";

// Two independent card columns: opening something inside a card only pushes the cards below it in
// the same column (a plain grid row would stretch both sides). Items alternate left/right, and on
// phones the columns dissolve into one list in the original order.
export function TwoColumns({ children, className = "" }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children);
  return <div className={`two-columns ${className}`}>
    {[0, 1].map((column) => <div className="two-columns-col" key={column}>
      {items.map((item, index) => index % 2 === column ? <div className="two-columns-item" key={index} style={{ order: index }}>{item}</div> : null)}
    </div>)}
  </div>;
}
