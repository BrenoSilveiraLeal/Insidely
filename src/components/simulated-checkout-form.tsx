"use client";
import { useState } from "react";
import { DirectPixCheckout } from "@/components/direct-pix-checkout";

const digits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

// Demo card fields: typed and checked in the browser only. They have no name, so nothing typed here
// is sent to the server (the simulated payment needs only the method).
function DemoCardFields() {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [code, setCode] = useState("");
  const checkExpiry = (input: HTMLInputElement, value: string) => {
    const [month, year] = value.split("/").map(Number);
    const now = new Date(), thisYear = now.getFullYear() % 100, thisMonth = now.getMonth() + 1;
    const valid = value.length === 5 && month >= 1 && month <= 12 && (year > thisYear || (year === thisYear && month >= thisMonth));
    input.setCustomValidity(valid || !value ? "" : "Informe uma validade futura no formato MM/AA.");
  };
  return <div className="panel form-stack demo-card">
    <p className="form-feedback">Ambiente de demonstração: não digite dados reais. Nada do que você digitar aqui é enviado.</p>
    <label className="field"><span>Nome impresso no cartão</span><input className="input" autoComplete="off" required placeholder="Como está no cartão"/></label>
    <label className="field"><span>Número do cartão</span><input className="input" inputMode="numeric" autoComplete="off" required placeholder="0000 0000 0000 0000" pattern="(\d{4} ){3}\d{1,4}( \d{1,3})?" title="Digite de 13 a 19 números." value={number} onChange={(event) => setNumber(digits(event.target.value, 19).replace(/(\d{4})(?=\d)/g, "$1 "))}/></label>
    <div className="profile-fields-row">
      <label className="field"><span>Validade</span><input className="input" inputMode="numeric" autoComplete="off" required placeholder="MM/AA" maxLength={5} value={expiry} onChange={(event) => { const raw = digits(event.target.value, 4); const value = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw; setExpiry(value); checkExpiry(event.target, value); }}/></label>
      <label className="field"><span>Código de segurança</span><input className="input" inputMode="numeric" autoComplete="off" required placeholder="CVV" pattern="\d{3,4}" title="3 ou 4 números." value={code} onChange={(event) => setCode(digits(event.target.value, 4))}/></label>
    </div>
  </div>;
}

export function SimulatedCheckoutForm({ bookingId, action }: { bookingId: string; action: (formData: FormData) => void | Promise<void> }) {
  const [method, setMethod] = useState("PIX");
  return <form action={action} className="form-stack">
    <label className="field"><span>Forma de pagamento</span><select className="select" name="method" value={method} onChange={(event) => setMethod(event.target.value)} required><option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão de crédito</option><option value="DEBIT_CARD">Cartão de débito</option></select></label>
    {method === "PIX" && <DirectPixCheckout payload={"INSIDELY-DEMO-" + bookingId} title="Pix demonstrativo" />}
    {(method === "CREDIT_CARD" || method === "DEBIT_CARD") && <DemoCardFields key={method}/>}
    <button className="button button-accent button-block" type="submit">Confirmar pagamento simulado</button><p className="muted" style={{ fontSize: 12 }}>Esta ação não acessa a Stripe e não movimenta dinheiro.</p>
  </form>;
}
