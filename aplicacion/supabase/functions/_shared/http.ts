import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
export const setting=(name:string)=>Deno.env.get(name)||'';
export const siteOrigin=()=>{const u=new URL(setting('SITE_URL'));if(u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw new Error('SITE_URL necesita HTTPS.');return u.origin;};
export function cors(req:Request){const origin=req.headers.get('origin');return {'Access-Control-Allow-Origin':origin===siteOrigin()?origin:siteOrigin(),'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};}
export const json=(req:Request,data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
export const adminClient=()=>createClient(setting('SUPABASE_URL'),setting('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
export async function identify(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==siteOrigin())throw new Error('Origen no permitido.');
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)throw new Error('Inicia sesión.');
 const client=createClient(setting('SUPABASE_URL'),setting('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);if(error||!data.user)throw new Error('Tu sesión venció. Ingresa nuevamente.');return {client,user:data.user};
}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>16384)throw new Error('Solicitud demasiado grande.');const raw=await req.text();if(raw.length>16384)throw new Error('Solicitud demasiado grande.');return JSON.parse(raw);}
export async function member(client:ReturnType<typeof createClient>,businessId:string,owner=false){
 if(!/^[0-9a-f-]{36}$/i.test(businessId||''))throw new Error('Negocio no válido.');
 const {data,error}=await client.from('business_members').select('role').eq('business_id',businessId).eq('user_id',(await client.auth.getUser()).data.user?.id).single();
 if(error||!data||(owner&&data.role!=='owner'))throw new Error(owner?'Solo el propietario puede administrar los pagos.':'No tienes acceso a este negocio.');return data;
}
export function failure(req:Request,error:unknown,status=400){return json(req,{error:error instanceof Error?error.message:'No fue posible completar la solicitud.'},status);}

