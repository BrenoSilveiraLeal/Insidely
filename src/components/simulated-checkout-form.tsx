"use client";
import { useState } from "react";
import { DirectPixCheckout } from "@/components/direct-pix-checkout";
export function SimulatedCheckoutForm({ bookingId, action }: { bookingId: string; action: (formData: FormData) => void | Promise<void> }) {
 const [method, setMethod] = useState("PIX");
 return <form action={action} className="form-stack">
 <label className="field"><span>Forma de pagamento</span><select className="select" name="method" value={method} onChange={(event) => setMethod(event.target.value)} required><option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão de crédito</option><option value="DEBIT_CARD">Cartão de débito</option><option value="BOLETO">Boleto</option></select></label>
 {method === "PIX" && <DirectPixCheckout payload={"INSIDELY-DEMO-" + bookingId} title="Pix demonstrativo" /> }
 {(method === "CREDIT_CARD" || method === "DEBIT_CARD") && <div className="panel"><p className="form-feedback">Ambiente de demonstração – não digite dados reais.</p><label>Número do cartão<input className="input" value="4242 4242 4242 4242" readOnly aria-label="Número de cartão demonstrativo"/></label><div className="profile-form-grid"><label>Validade<input className="input" value="12/30" readOnly aria-label="Validade demonstrativa"/></label><label>Código<input className="input" value="123" readOnly aria-label="Código demonstrativo"/></label></div></div>}
 {method === "BOLETO" && <div className="panel"><strong>Boleto demonstrativo</strong><p className="muted">Linha digitável fictícia</p><code>23790.00000 00000.000000 00000.000000 0 00000000000000</code></div>}
 <button className="button button-accent button-block" type="submit">Confirmar pagamento simulado</button><p className="muted" style={{fontSize:12}}>Esta ação não acessa a Stripe e não movimenta dinheiro.</p></form>;
}