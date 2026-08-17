"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import QRCode from "qrcode";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
type Factor={id:string;friendly_name?:string;status:string};
export function MfaSettings({challenge=false}:{challenge?:boolean}){
 const[client]=useState(createSupabaseBrowserClient),router=useRouter();
 const[factors,setFactors]=useState<Factor[]>([]),[factorId,setFactorId]=useState(""),[qr,setQr]=useState(""),[code,setCode]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const refresh=async()=>{const{data,error}=await client.auth.mfa.listFactors();if(error)setMessage("Não foi possível consultar o 2FA.");else setFactors(data.totp)};
 useEffect(()=>{let active=true;void client.auth.mfa.listFactors().then(({data,error})=>{if(!active)return;if(error)setMessage("Não foi possível consultar o 2FA.");else setFactors(data.totp)});return()=>{active=false}},[client]);
 const enroll=async()=>{setBusy(true);const{data,error}=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"Insidely"});if(error)setMessage("Não foi possível iniciar a configuração.");else{setFactorId(data.id);setQr(await QRCode.toDataURL(data.totp.uri,{width:220,margin:1}))}setBusy(false)};
 const verify=async(id=factorId)=>{if(!/^\d{6}$/.test(code))return setMessage("Digite os seis números do aplicativo autenticador.");setBusy(true);const{data,error}=await client.auth.mfa.challengeAndVerify({factorId:id,code});if(error)setMessage("Código inválido ou expirado.");else if(challenge)router.replace("/continuar");else{setMessage(data?"2FA ativado com sucesso.":"Não foi possível confirmar.");setQr("");setCode("");await refresh()}setBusy(false)};
 const remove=async(id:string)=>{setBusy(true);const{error}=await client.auth.mfa.unenroll({factorId:id});setMessage(error?"Não foi possível remover o fator.":"2FA removido.");await refresh();setBusy(false)};
 const verified=factors.filter(f=>f.status==="verified");
 return <section className="panel form-stack" aria-labelledby="mfa-title"><span className="eyebrow">Segurança da conta</span><h2 id="mfa-title">{challenge?"Confirme seu acesso":"Autenticação em dois fatores"}</h2><p className="muted">{challenge?"Abra o aplicativo autenticador e informe o código atual.":"Use um aplicativo TOTP, como Google Authenticator. A configuração é opcional."}</p>{message&&<p className="form-feedback" role="status" aria-live="polite">{message}</p>}{challenge&&verified[0]&&<Code value={code} setValue={setCode}/>} {challenge&&verified[0]&&<button className="button button-accent" disabled={busy} onClick={()=>verify(verified[0].id)}>Verificar código</button>}{!challenge&&!qr&&!verified.length&&<button className="button button-dark" disabled={busy} onClick={enroll}>Configurar 2FA</button>}{qr&&<><Image width={220} height={220} src={qr} unoptimized alt="QR Code para configurar o aplicativo autenticador"/><Code value={code} setValue={setCode}/><button className="button button-accent" disabled={busy} onClick={()=>verify()}>Confirmar e ativar</button></>}{!challenge&&verified.map(f=><div className="list-row" key={f.id}><span>{f.friendly_name||"Aplicativo autenticador"} · ativo</span><button className="button button-ghost button-sm" disabled={busy} onClick={()=>remove(f.id)}>Remover</button></div>)}</section>
}
function Code({value,setValue}:{value:string;setValue:(value:string)=>void}){return <label htmlFor="totp-code">Código de seis dígitos<input id="totp-code" className="input totp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={value} onChange={event=>setValue(event.target.value.replace(/\D/g,""))}/></label>}
