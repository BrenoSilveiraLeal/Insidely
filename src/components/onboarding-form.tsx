"use client";
import { KeepValuesForm } from "@/components/keep-values-form";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Compass, Mic } from "lucide-react";
import { completeOnboardingAction } from "@/app/actions";
import { CustomerIdentityFields } from "@/components/customer-identity-form";
import { CatalogPicker } from "@/components/catalog-picker";
import { TimedMessage } from "@/components/timed-message";
import { CityInput } from "@/components/city-input";
import { findUnsafeProfileText, unsafeProfileTextMessage } from "@/lib/chat-moderation";
type Option={id:string;name:string};
type Role="USER"|"CONSULTANT";

// Same fields and labels the server checks (ONBOARDING_PROFILE_TEXTS in actions.ts), checked here
// too so a bad word is caught on the profile step instead of after the last one.
const PROFILE_TEXTS:[string,string][]=[["Título profissional","headline"],["Cargo","title"],["Localização","location"],["O que você pode contextualizar","bio"],["Empresa","companyIdName"],["Área ou profissão","professionIdName"]];

// Each submission gets a stamp, so the same error twice still shows (and fades) again.
async function submitOnboarding(_:{text?:string;at:number}|undefined,formData:FormData){return {text:await completeOnboardingAction(undefined,formData),at:Date.now()};}

const ROLES: { value: Role; icon: typeof Compass; title: string; lead: string; points: string[] }[] = [
  { value: "USER", icon: Compass, title: "Quero conversar com profissionais", lead: "Para decidir uma vaga, um curso ou uma mudança de carreira.", points: ["Encontre quem trabalha na empresa ou área que te interessa", "Agende uma conversa por vídeo de 30 ou 60 minutos", "Pague pela Insidely, com o valor protegido até a conversa acontecer"] },
  { value: "CONSULTANT", icon: Mic, title: "Quero compartilhar minha experiência", lead: "Para contar como é a rotina real do seu trabalho e ser pago por isso.", points: ["Monte um perfil público com o nível de privacidade que você escolher", "Defina seu valor e os horários em que pode conversar", "Receba por cada conversa realizada; você também pode agendar como cliente"] },
];

// Sign-up completion as short guided steps: how the person will use the platform, then (consultants
// only) the professional profile, then identification and terms. Each step checks its own fields
// before moving on, so a hidden required field never blocks the final submit.
export function OnboardingForm({firstName,initialRole,companies,professions,next}:{firstName:string;initialRole:Role;companies:Option[];professions:Option[];next?:string}){
  const [role,setRole]=useState<Role>(initialRole);
  const [step,setStep]=useState(0);
  const [result,action,pending]=useActionState(submitOnboarding,undefined);
  const [stepError,setStepError]=useState<{text:string;at:number}|null>(null);
  const [navAt,setNavAt]=useState(0);
  const steps=useRef<(HTMLFieldSetElement|null)[]>([]);
  const top=useRef<HTMLDivElement>(null);
  const consultant=role==="CONSULTANT";
  const titles=consultant?["Como você quer usar","Seu perfil profissional","Identificação"]:["Como você quer usar","Identificação"];
  const last=titles.length-1;
  // A server error about the profile sends the person back to the profile step until they move on.
  const profileFix=consultant&&!!result?.text&&/^O campo "|confidencialidade/i.test(result.text)&&result.at>navAt;
  const current=profileFix?1:Math.min(step,last);
  const go=(target:number)=>{ setStep(target); setNavAt(Date.now()); setStepError(null); requestAnimationFrame(()=>{ top.current?.scrollIntoView({behavior:"smooth",block:"start"}); steps.current[target]?.querySelector<HTMLElement>("h2")?.focus({preventScroll:true}); }); };
  const showError=(text:string)=>{ setStepError({text,at:Date.now()}); requestAnimationFrame(()=>top.current?.scrollIntoView({behavior:"smooth",block:"start"})); };
  const advance=()=>{
    const box=steps.current[current];
    const fields=box?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea")??[];
    for(const field of fields){ if(!field.checkValidity()){ field.reportValidity(); return; } }
    if(consultant&&current===1&&box){
      const form=box.closest("form");
      const found=form?findUnsafeProfileText(PROFILE_TEXTS.map(([label,name])=>[label,new FormData(form).getAll(name).map(String).join(" ")])):null;
      if(found){ showError(unsafeProfileTextMessage(found)); return; }
    }
    go(current+1);
  };
  // A server error goes back to the step that holds the problem and is shown at the top of it.
  useEffect(()=>{
    if(!result?.text)return;
    requestAnimationFrame(()=>top.current?.scrollIntoView({behavior:"smooth",block:"start"}));
  },[result]);
  const message=stepError??(result?.text?{text:result.text,at:result.at}:null);
  const stepIndex=(name:"role"|"profile"|"identity")=>name==="role"?0:name==="profile"?1:last;
  return <KeepValuesForm action={action} className="auth-form onboarding-flow">
    {next&&<input type="hidden" name="next" value={next}/>}
    <div ref={top} className="onboarding-progress" aria-label={`Etapa ${current+1} de ${titles.length}: ${titles[current]}`}>
      <span className="onboarding-progress-label">Olá, {firstName} · etapa {current+1} de {titles.length}</span>
      <div className="onboarding-progress-bar">{titles.map((title,index)=><span key={title} className={index<=current?"is-done":undefined}/>)}</div>
    </div>
    {message&&<TimedMessage key={message.at} text={message.text} error duration={9000}/>}

    <fieldset className="onboarding-step" hidden={current!==stepIndex("role")} ref={(el)=>{steps.current[0]=el;}}>
      <h2 tabIndex={-1}>Como você quer usar a Insidely?</h2>
      <p className="onboarding-lead">Escolha o que combina com você agora. Dá para mudar depois.</p>
      <div className="role-cards" role="radiogroup" aria-label="Como você quer participar">
        {ROLES.map(({value,icon:Icon,title,lead,points})=><label key={value} className={`role-card${role===value?" is-selected":""}`}>
          <input type="radio" name="role" value={value} checked={role===value} onChange={()=>setRole(value)}/>
          <span className="role-card-head"><span className="role-card-icon" aria-hidden="true"><Icon size={20}/></span><strong>{title}</strong><span className="role-card-check" aria-hidden="true"><Check size={14}/></span></span>
          <span className="role-card-lead">{lead}</span>
          <ul>{points.map((point)=><li key={point}>{point}</li>)}</ul>
        </label>)}
      </div>
      <div className="onboarding-nav"><button type="button" className="button button-accent" onClick={advance}>Continuar<ArrowRight size={17}/></button></div>
    </fieldset>

    {consultant&&<fieldset className="onboarding-step" hidden={current!==1} ref={(el)=>{steps.current[1]=el;}}>
      <h2 tabIndex={-1}>Seu perfil profissional</h2>
      <p className="onboarding-lead">É o que as pessoas veem antes de agendar com você. Tudo pode ser editado depois.</p>
      <ConsultantProfileFields companies={companies} professions={professions}/>
      <div className="onboarding-nav"><button type="button" className="button button-ghost" onClick={()=>go(0)}><ArrowLeft size={17}/>Voltar</button><button type="button" className="button button-accent" onClick={advance}>Continuar<ArrowRight size={17}/></button></div>
    </fieldset>}

    <fieldset className="onboarding-step" hidden={current!==last} ref={(el)=>{steps.current[last]=el;}}>
      <h2 tabIndex={-1}>Identificação</h2>
      <p className="onboarding-lead">Toda conta na Insidely se identifica com CPF, para a segurança de quem agenda e de quem atende. O CPF nunca aparece no perfil.</p>
      <CustomerIdentityFields/>
      <label className="check-row"><input name="terms" type="checkbox" required/><span>Li e concordo com os <Link href="/termos" target="_blank"><u>Termos de Uso</u></Link>, a <Link href="/privacidade" target="_blank"><u>Política de Privacidade</u></Link> e as regras de conversas da plataforma.</span></label>
      <div className="onboarding-nav"><button type="button" className="button button-ghost" onClick={()=>go(current-1)}><ArrowLeft size={17}/>Voltar</button><button className="button button-accent" type="submit" disabled={pending}>{pending?"Salvando…":"Concluir cadastro"}</button></div>
    </fieldset>
  </KeepValuesForm>
}

const BIO_MIN=30;
const thisMonth=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;};

// Current or former employee, the period and what the person does or did there. Former employees
// are welcome: they usually speak more freely about the company.
function EmploymentFields(){
  const [status,setStatus]=useState<"current"|"former">("current");
  const [max]=useState(thisMonth);
  return <fieldset className="employment-fields">
    <legend>Você ainda trabalha nessa empresa?</legend>
    <div className="employment-choice" role="radiogroup">
      <label className={status==="current"?"is-selected":undefined}><input type="radio" name="employmentStatus" value="current" checked={status==="current"} onChange={()=>setStatus("current")}/>Sim, trabalho lá atualmente</label>
      <label className={status==="former"?"is-selected":undefined}><input type="radio" name="employmentStatus" value="former" checked={status==="former"} onChange={()=>setStatus("former")}/>Não, já saí</label>
    </div>
    <div className="profile-fields-row">
      <div className="field"><label htmlFor="startedAt">Entrei em</label><input className="input" id="startedAt" name="startedAt" type="month" max={max} required/></div>
      {status==="former"&&<div className="field"><label htmlFor="endedAt">Saí em</label><input className="input" id="endedAt" name="endedAt" type="month" max={max} required/></div>}
    </div>
    <div className="field"><label htmlFor="experienceSummary">{status==="former"?"O que você fazia lá":"O que você faz lá"}</label><textarea className="textarea" id="experienceSummary" name="experienceSummary" rows={3} minLength={15} maxLength={300} required placeholder={status==="former"?"Ex.: Cuidava do atendimento a lojistas e de relatórios mensais do time de vendas.":"Ex.: Cuido do atendimento a lojistas e dos relatórios mensais do time de vendas."}/></div>
    <p className="employment-note">{status==="former"?"Ótimo: quem já saiu costuma falar com mais liberdade. Quem agenda vai ver de que época é a sua visão.":"Por padrão, seu nome e sua foto não aparecem no perfil. Em Privacidade, você também pode esconder o nome da empresa e mostrar só a área."}</p>
  </fieldset>;
}

// Also used by the "become a consultant" page, which adds a profile to an existing customer account.
export function ConsultantProfileFields({companies,professions}:{companies:Option[];professions:Option[]}){
  const [bioLength,setBioLength]=useState(0);
  return <div className="profile-fields">
    <div className="profile-fields-group">
      <div className="field"><label htmlFor="headline">Título do perfil</label><input className="input" id="headline" name="headline" placeholder="Ex.: Product Designer em fintech" required/><small className="muted">Uma frase curta que aparece embaixo do seu nome.</small></div>
      <div className="field"><label htmlFor="title">Cargo atual ou mais recente</label><input className="input" id="title" name="title" placeholder="Ex.: Analista de Produto Pleno" required/></div>
      <CatalogPicker id="companyId" name="companyId" label="Empresa" kind="company" options={companies} required/>
      <CatalogPicker id="professionId" name="professionId" label="Área ou profissão" kind="profession" options={professions} required/>
      <EmploymentFields/>
      <div className="field"><label htmlFor="location">Cidade onde você mora</label><CityInput id="location" name="location" required/></div>
    </div>
    <div className="field"><label htmlFor="bio">Sobre você</label><textarea className="textarea" id="bio" name="bio" rows={5} minLength={BIO_MIN} required aria-describedby="bio-hint" onInput={(event)=>setBioLength(event.currentTarget.value.trim().length)} placeholder="Conte em poucas frases o que você vive no dia a dia e sobre o que pode conversar. Ex.: Trabalhei 4 anos com produto em fintechs. Posso contar como era a rotina do time, como funciona o processo seletivo e o que eu gostaria de ter sabido antes de entrar."/><small id="bio-hint" className={`muted bio-counter${bioLength>=BIO_MIN?" is-ok":""}`}>{bioLength>=BIO_MIN?"Ótimo. Quanto mais concreto, mais fácil para quem vai agendar.":`Pelo menos ${BIO_MIN} caracteres · faltam ${BIO_MIN-bioLength}`}</small></div>
    <div className="field"><label htmlFor="price30">Quanto você quer receber por conversa de 30 min (R$)</label><input className="input" id="price30" name="price30" type="number" min="10" max="1000" step="1" defaultValue="50" required/><small className="muted">É o valor que você recebe; a taxa da Insidely é somada no pagamento do cliente. Dá para mudar depois.</small></div>
    <label className="check-row"><input name="confidentiality" type="checkbox" required/><span><strong>Confidencialidade:</strong> não vou revelar segredos da empresa, dados internos, informações de clientes ou de colegas. Falo apenas da minha experiência.</span></label>
  </div>
}
