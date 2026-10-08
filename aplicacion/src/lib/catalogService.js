import {createClient} from '@supabase/supabase-js';
import {supabase,supabaseUrl,supabaseAnonKey,isSupabaseConfigured} from './supabase.js';
let publicClient;
export async function readPublicCatalog(slug,signal) {
 if(!isSupabaseConfigured)throw new Error('CATALOG_NOT_CONFIGURED');
 // No session, local cache or private business query on the visitor's route.
 publicClient ||= createClient(supabaseUrl,supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}});
 const {data,error}=await publicClient.rpc('get_public_business_catalog',{p_slug:slug}).abortSignal(signal);
 if(error)throw error;return data;
}
export async function loadCatalogSettings(businessId) {
 if(!supabase)throw new Error('Conecta las cuentas para administrar tu página.');
 const {data,error}=await supabase.rpc('get_business_catalog_settings',{p_business_id:businessId});if(error)throw error;return data;
}
export async function saveCatalogSettings(businessId,version,settings,published) {
 if(!supabase)throw new Error('Conecta las cuentas para publicar tu página.');
 const {data,error}=await supabase.rpc('save_business_catalog',{p_business_id:businessId,p_expected_version:version,p_settings:settings,p_published:published});if(error)throw error;return data;
}
