"use client";
import { DateTextInput } from "@/components/masked-inputs";
import { CityInput } from "@/components/city-input";
import { SuggestInput } from "@/components/suggest-input";
import { KeepValuesForm } from "@/components/keep-values-form";
import { Plus, Trash2, Upload } from "lucide-react";
import { useActionState, useState } from "react";
import { CatalogPicker } from "@/components/catalog-picker";
import { FilePicker } from "@/components/file-picker";
import { VERIFICATION_METHODS } from "@/lib/verification";
import { deleteAccountAction, saveAreaInsightsAction, saveWelcomeMessageAction, submitVerificationAction, updateProfessionalProfileAction } from "@/app/actions";
type Option={id:string;name:string}; type Experience={id?:string;companyId?:string;professionId?:string;pendingCompanyName?:string|null;pendingProfessionName?:string|null;title?:string;area?:string;isCurrent?:boolean;startedAt?:Date|null;endedAt?:Date|null;summary?:string}; type Profile={headline:string;bio:string;publicSurname?:string|null;pseudonym?:string|null;ageRange?:string|null;location:string;region:string;workMode:string;seniority:string;yearsExperience:number;price30Cents:number;price60Cents:number;responseHours:number;pixKey?:string|null;topics:string[];boundaries:string[];experiences:Experience[]};
// The consultant picks which experience (current or former) the proof is about.
export function VerificationRequestForm({experiences=[]}:{experiences?:{id:string;label:string}[]}){const[message,action,pending]=useActionState(submitVerificationAction,undefined);return <form className="verification-form" action={action}>{experiences.length>0&&<label className="field"><span className="field-label">Qual experiência você vai comprovar?</span><select className="select" name="experienceId" defaultValue={experiences[0].id} required>{experiences.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}<fieldset className="verification-methods"><legend>O que você vai enviar?</legend>{VERIFICATION_METHODS.map((item,index)=><label className="verification-method" key={item.value}><input type="radio" name="method" value={item.value} defaultChecked={index===0} required/><span><strong>{item.label}</strong><small>{item.hint}</small></span></label>)}</fieldset><div className="field"><span className="field-label">Foto ou PDF do comprovante</span><FilePicker id="document" name="document" accept="application/pdf,image/png,image/jpeg,image/webp" hint="PDF, JPG, PNG ou WEBP de até 5 MB." required/></div><div className="verification-note"><Upload size={18}/><span>O arquivo fica privado. No perfil público aparece apenas o resultado da verificação.</span></div>{message&&<p className="form-feedback">{message}</p>}<button className="button button-accent" disabled={pending}>{pending?"Enviando…":"Enviar para verificação"}</button></form>}
// What every consultant can talk about and what stays out: fixed for everyone (not editable).
const FIXED_TOPICS = "Rotina real, Cultura da equipe, Processo seletivo, Crescimento, Carga de trabalho";
const FIXED_BOUNDARIES = "Informações confidenciais, Documentos internos, Dados pessoais de terceiros";

// One experience block. "Ainda trabalho aqui" hides the leaving date; blocks 2 and 3 can be removed.
function ExperienceEditor({index,experience,companies,professions,jobTitles,onRemove}:{index:number;experience:Experience;companies:Option[];professions:Option[];jobTitles:string[];onRemove?:()=>void}){
  const [current,setCurrent]=useState(experience.isCurrent??index===0);
  const [max]=useState(()=>new Date().toISOString().slice(0,7));
  return <fieldset className="experience-card">
    <div className="experience-card-head"><legend>{index===0?"Experiência principal":`Experiência ${index+1}`}</legend>{onRemove&&<button type="button" className="experience-remove" onClick={onRemove}><Trash2 size={14}/> Remover</button>}</div>
    <input type="hidden" name={`experienceId${index}`} defaultValue={experience.id??""}/>
    <input type="hidden" name={`area${index}`} defaultValue={experience.area??""}/>
    <CatalogPicker id={`companyId${index}`} name={`companyId${index}`} label="Empresa" kind="company" options={companies} defaultId={experience.companyId} defaultPendingName={experience.pendingCompanyName} required/>
    <div className="profile-fields-row">
      <CatalogPicker id={`professionId${index}`} name={`professionId${index}`} label="Área" kind="profession" options={professions} defaultId={experience.professionId} defaultPendingName={experience.pendingProfessionName} required/>
      <div className="field"><label htmlFor={`title${index}`}>Cargo</label><SuggestInput id={`title${index}`} name={`title${index}`} options={jobTitles} defaultValue={experience.title??""} required placeholder="Ex.: Analista de Dados"/></div>
    </div>
    <div className="employment-choice" role="radiogroup" aria-label="Você ainda trabalha lá?">
      <label className={current?"is-selected":undefined}><input type="radio" checked={current} onChange={()=>setCurrent(true)}/>Ainda trabalho aqui</label>
      <label className={!current?"is-selected":undefined}><input type="radio" checked={!current} onChange={()=>setCurrent(false)}/>Já saí</label>
    </div>
    {current&&<input type="hidden" name={`isCurrent${index}`} value="on"/>}
    <div className="profile-fields-row">
      <div className="field"><label htmlFor={`startedAt${index}`}>Entrei em</label><DateTextInput id={`startedAt${index}`} name={`startedAt${index}`} mode="month" monthValue="first-day" max={max} defaultValue={experience.startedAt?.toISOString().slice(0,10)} required/></div>
      {!current&&<div className="field"><label htmlFor={`endedAt${index}`}>Saí em</label><DateTextInput id={`endedAt${index}`} name={`endedAt${index}`} mode="month" monthValue="first-day" max={max} defaultValue={experience.endedAt?.toISOString().slice(0,10)} required/></div>}
    </div>
    <div className="field"><label htmlFor={`summary${index}`}>{current?"O que você faz lá":"O que você fazia lá"}</label><textarea className="textarea" id={`summary${index}`} name={`summary${index}`} rows={2} maxLength={300} defaultValue={experience.summary??""} placeholder="Ex.: Atendimento a lojistas e relatórios do time de vendas."/></div>
  </fieldset>;
}

export function ProfessionalProfileForm({profile,companies,professions,jobTitles=[]}:{profile:Profile;companies:Option[];professions:Option[];jobTitles?:string[];areas?:string[]}){
  const[message,action,pending]=useActionState(updateProfessionalProfileAction,undefined);
  // Blocks shown: the saved experiences (at least one). Keys survive removals.
  const [blocks,setBlocks]=useState(()=>(profile.experiences.length?profile.experiences:[{}]).slice(0,3).map((experience,index)=>({key:`saved-${index}`,experience})));
  const add=()=>setBlocks((list)=>list.length>=3?list:[...list,{key:`new-${Date.now()}`,experience:{}}]);
  const remove=(key:string)=>setBlocks((list)=>list.filter((block)=>block.key!==key));
  return <section className="panel professional-edit-panel">
    <h2>Seu perfil público</h2>
    <p className="muted">É o que as pessoas leem antes de agendar uma conversa com você.</p>
    <KeepValuesForm action={action} className="profile-edit-form">
      <input type="hidden" name="topics" value={FIXED_TOPICS}/>
      <input type="hidden" name="boundaries" value={FIXED_BOUNDARIES}/>
      <input type="hidden" name="responseHours" value={profile.responseHours||24}/>
      <input type="hidden" name="region" value={profile.region||"Brasil"}/>
      <input type="hidden" name="yearsExperience" value={profile.yearsExperience}/>

      <div className="profile-edit-section">
        <h3><span>1</span> Como você aparece</h3>
        <div className="field"><label htmlFor="profile-headline">Título do perfil</label><input className="input" id="profile-headline" name="headline" defaultValue={profile.headline} placeholder="Ex.: Product Designer em fintech" required/></div>
        <div className="field"><label htmlFor="profile-bio">Sobre você</label><textarea className="textarea" id="profile-bio" name="bio" rows={4} defaultValue={profile.bio} placeholder="Sobre o que você pode conversar? Ex.: Posso contar como era a rotina do time, o processo seletivo e o que eu gostaria de ter sabido antes." required/></div>
        <div className="profile-fields-row">
          <div className="field"><label htmlFor="profile-location">Cidade</label><CityInput id="profile-location" name="location" defaultValue={profile.location} required/></div>
          <div className="field"><label htmlFor="profile-mode">Modelo de trabalho</label><select className="select" id="profile-mode" name="workMode" defaultValue={profile.workMode}><option value="REMOTE">Remoto</option><option value="HYBRID">Híbrido</option><option value="ONSITE">Presencial</option></select></div>
        </div>
        <div className="field"><label htmlFor="profile-seniority">Nível</label><select className="select" id="profile-seniority" name="seniority" defaultValue={profile.seniority}><option value="INTERN">Estágio</option><option value="JUNIOR">Júnior</option><option value="MID">Pleno</option><option value="SENIOR">Sênior</option><option value="LEAD">Liderança</option><option value="MANAGER">Gestão</option></select></div>
        <details className="profile-edit-more"><summary>Nome e idade no perfil</summary>
          <p className="muted">Por padrão o perfil não mostra seu nome. Você escolhe o que aparece em Privacidade do perfil.</p>
          <div className="profile-fields-row">
            <div className="field"><label htmlFor="profile-pseudonym">Nome fictício</label><input className="input" id="profile-pseudonym" name="pseudonym" maxLength={40} defaultValue={profile.pseudonym??""} placeholder="Ex.: Dev Backend SP"/></div>
            <div className="field"><label htmlFor="profile-surname">Sobrenome público</label><input className="input" id="profile-surname" name="publicSurname" defaultValue={profile.publicSurname??""}/></div>
          </div>
          <div className="field"><label htmlFor="profile-age">Faixa etária</label><select className="select" id="profile-age" name="ageRange" defaultValue={profile.ageRange??""}><option value="">Não informar</option><option value="UNDER_25">Até 24</option><option value="25_34">25–34</option><option value="35_44">35–44</option><option value="45_54">45–54</option><option value="55_PLUS">55+</option></select></div>
        </details>
      </div>

      <div className="profile-edit-section">
        <h3><span>2</span> Onde você trabalha ou trabalhou</h3>
        {blocks.map((block,index)=><ExperienceEditor key={block.key} index={index} experience={block.experience} companies={companies} professions={professions} jobTitles={jobTitles} onRemove={index>0?()=>remove(block.key):undefined}/>)}
        {blocks.length<3&&<button type="button" className="experience-add" onClick={add}><Plus size={16}/> Adicionar outra empresa</button>}
        <small className="muted">Até 3 empresas. Você aparece na busca de cada uma delas.</small>
      </div>

      <div className="profile-edit-section">
        <h3><span>3</span> Valores e recebimento</h3>
        <div className="profile-fields-row">
          <div className="field"><label htmlFor="profile-price30">Conversa de 30 min (R$)</label><input className="input" id="profile-price30" type="number" name="price30Cents" min="10" step="0.01" defaultValue={(profile.price30Cents/100).toFixed(2)} required/></div>
          <div className="field"><label htmlFor="profile-price60">Conversa de 60 min (R$)</label><input className="input" id="profile-price60" type="number" name="price60Cents" min="10" step="0.01" defaultValue={(profile.price60Cents/100).toFixed(2)} required/></div>
        </div>
        <div className="field"><label htmlFor="profile-pix">Chave Pix para receber</label><input className="input" id="profile-pix" name="pixKey" defaultValue={profile.pixKey??""} placeholder="CPF, e-mail, celular ou chave aleatória" required/><small className="muted">É para onde vai o valor das suas conversas. Não aparece no perfil.</small></div>
      </div>

      {message&&<p className={message.startsWith("Perfil profissional atualizado") ? "form-feedback" : "form-error"} role="status">{message}</p>}
      <div className="profile-edit-actions"><button className="button button-dark" disabled={pending}>{pending?"Salvando…":"Salvar perfil"}</button></div>
    </KeepValuesForm>
  </section>;
}
// Account deletion: what happens, then a confirmation that only enables the button once the
// e-mail typed matches the account.
export function AccountDangerZone({email}:{email:string}){const[message,action,pending]=useActionState(deleteAccountAction,undefined);const[typed,setTyped]=useState("");const ok=typed.trim().toLowerCase()===email.trim().toLowerCase();return <section className="panel danger-zone"><div className="danger-zone-head"><span className="danger-zone-icon" aria-hidden="true"><Trash2 size={20}/></span><div><h2>Excluir minha conta</h2><p className="muted">Essa ação não pode ser desfeita pelo app.</p></div></div><ul className="danger-zone-list"><li>Seu acesso, sua foto e seu perfil público são removidos.</li><li>Por obrigação legal, o CPF e o histórico de conversas ficam guardados.</li><li>Se você voltar com o mesmo CPF, esta conta é reativada.</li></ul><details className="danger-zone-confirm"><summary>Quero excluir minha conta</summary><form action={action} className="danger-zone-form"><label htmlFor="delete-confirmation">Para confirmar, digite o e-mail da sua conta: <strong>{email}</strong></label><input className="input" id="delete-confirmation" name="confirmation" type="email" autoComplete="off" placeholder="Digite aqui o seu e-mail" value={typed} onChange={(event)=>setTyped(event.target.value)} required/>{message&&<p className="form-error" role="alert">{message}</p>}<button className="button danger-button" type="submit" disabled={pending||!ok}><Trash2 size={16}/> {pending?"Excluindo…":"Excluir conta definitivamente"}</button>{!ok&&typed.length>3&&<small className="muted">O e-mail precisa ser igual ao da conta.</small>}</form></details></section>}

// Posted in the chat on the consultant's behalf when a payment is confirmed.
export function WelcomeMessageForm({ defaultValue }: { defaultValue: string }) {
  const [state, action, pending] = useActionState(saveWelcomeMessageAction, undefined);
  return <section className="panel form-stack"><span className="eyebrow">Mensagem de boas-vindas</span><h2>Receba cada cliente no chat.</h2><p className="muted">Assim que um pagamento é confirmado, esta mensagem aparece no chat da conversa como se você tivesse escrito. Deixe vazio para não enviar. Contatos e palavrões não são permitidos.</p><form action={action} className="form-stack"><textarea className="textarea" name="welcomeMessage" maxLength={600} defaultValue={defaultValue} placeholder="Ex.: Olá! Obrigado por agendar. Se quiser, me conte aqui o que mais te preocupa na decisão, assim chego preparado."/>{state && <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}<button className="button button-dark button-sm" disabled={pending}>{pending ? "Salvando…" : "Salvar mensagem"}</button></form></section>;
}

const SALARY_OPTIONS = [["ATE_3K", "Até R$ 3 mil"], ["3K_6K", "R$ 3 a 6 mil"], ["6K_10K", "R$ 6 a 10 mil"], ["10K_15K", "R$ 10 a 15 mil"], ["15K_25K", "R$ 15 a 25 mil"], ["ACIMA_25K", "Acima de R$ 25 mil"]] as const;

// Anonymous answers shown, aggregated, on the profession page.
export function AreaInsightsForm({ salaryRange, areaPro, areaCon }: { salaryRange: string | null; areaPro: string | null; areaCon: string | null }) {
  const [state, action, pending] = useActionState(saveAreaInsightsAction, undefined);
  return <section className="panel form-stack"><span className="eyebrow">Sobre a sua área</span><h2>Ajude quem está decidindo.</h2><p className="muted">Respostas anônimas: aparecem somadas às de outros consultores na página da sua profissão, nunca com o seu nome.</p><form action={action} className="form-stack"><label className="field"><span>Faixa salarial do seu cargo</span><select className="select" name="salaryRange" defaultValue={salaryRange ?? ""}><option value="">Prefiro não informar</option>{SALARY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Uma coisa boa da rotina</span><input className="input" name="areaPro" maxLength={200} defaultValue={areaPro ?? ""} placeholder="Ex.: Muita autonomia para decidir como fazer o trabalho"/></label><label className="field"><span>Uma coisa difícil da rotina</span><input className="input" name="areaCon" maxLength={200} defaultValue={areaCon ?? ""} placeholder="Ex.: Prazos apertados no fim de cada trimestre"/></label>{state && <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}<button className="button button-dark button-sm" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button></form></section>;
}
