"use client";
import { useState } from "react";

// Two choices side by side (a confirm form and a "problem" button). The problem button stays where it
// is when pressed; only the box to describe the problem opens below the row.
export function ChoiceWithReport({ confirm, reportLabel, children }: { confirm: React.ReactNode; reportLabel: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <div className="policy-actions">{confirm}<button type="button" className="button button-ghost button-sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{reportLabel}</button></div>
    {open && <div className="policy-report-panel">{children}</div>}
  </>;
}
