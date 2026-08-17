import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const authorization=req.headers.get("authorization");
 const url=Deno.env.get("SUPABASE_URL"),publishable=Deno.env.get("SUPABASE_ANON_KEY"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!authorization||!url||!publishable||!serviceRole)return json({error:"service_unavailable"},503);
 const caller=createClient(url,publishable,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const{data:{user},error}=await caller.auth.getUser();if(error||!user?.email)return json({error:"unauthorized"},401);
 let body:{confirmation?:unknown};try{body=await req.json()}catch{return json({error:"invalid_body"},400)}
 if(typeof body.confirmation!=="string"||body.confirmation.trim().toLowerCase()!==user.email.toLowerCase())return json({error:"confirmation_mismatch"},400);
 const admin=createClient(url,serviceRole,{auth:{persistSession:false}});
 const{data:stored}=await admin.from("User").select("id,image").eq("auth_user_id",user.id).maybeSingle();
 for(const bucket of ["avatars","verification-documents"]){const{data:files}=await admin.storage.from(bucket).list(user.id,{limit:1000});if(files?.length)await admin.storage.from(bucket).remove(files.map(file=>`${user.id}/${file.name}`))}
 await admin.from("AccountDeletionAudit").insert({auth_user_id:user.id});
 if(stored)await admin.from("User").update({name:"Conta excluída",email:`deleted+${user.id}@invalid.insidely`,image:null,auth_user_id:null,onboardingCompleted:false,updatedAt:new Date().toISOString()}).eq("id",stored.id);
 const{error:deleteError}=await admin.auth.admin.deleteUser(user.id);if(deleteError)return json({error:"delete_failed"},500);
 return json({ok:true});
});
