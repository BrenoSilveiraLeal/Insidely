"use client";

export function PrintButton({ label = "Imprimir ou salvar em PDF" }: { label?: string }) {
  return <button className="button button-dark no-print" type="button" onClick={() => window.print()}>{label}</button>;
}
