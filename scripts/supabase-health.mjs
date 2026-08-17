const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key){console.error("Supabase health check: variáveis públicas ausentes.");process.exit(1)}
try{const response=await fetch(`${url}/rest/v1/`,{method:"HEAD",headers:{apikey:key}});if(!response.ok)throw new Error(`HTTP ${response.status}`);console.log("Supabase Data API acessível.");}catch(error){console.error("Supabase health check falhou:",error instanceof Error?error.message:"erro desconhecido");process.exit(1)}
