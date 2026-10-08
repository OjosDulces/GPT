import {supabase} from './supabase.js';
export const isDemo=()=>Boolean(window.businessContext?.demo);
export const isLocal=()=>Boolean(window.businessContext?.local);
export const isOfflineWorkspace=()=>isDemo()||isLocal();
export const businessId=()=>window.businessContext?.id;
export async function invokeService(name,body={}){
 if(!supabase)throw new Error('Este servicio necesita una cuenta conectada.');
 const {data,error}=await supabase.functions.invoke(name,{body:{businessId:businessId(),...body}});
 if(error){let message;try{message=(await error.context?.json())?.error;}catch{}throw new Error(message||'El servicio no está disponible. Revisa la conexión o su activación.');}
 if(data?.error)throw new Error(data.error);return data;
}
export async function rpc(name,args={}){
 if(!supabase)throw new Error('Necesitas una cuenta conectada.');const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data;
}
export async function reportDiagnostic(code){
 try{if(!isDemo()&&supabase&&businessId())await supabase.rpc('log_app_error',{p_business_id:businessId(),p_code:code});}catch{/* Diagnostics never interfere with the operation. */}
}

