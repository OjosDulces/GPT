import { setting } from './http.ts';
export function billingEnabled(){return setting('BILLING_ENABLED')==='true'&&Boolean(setting('WEBPAY_COMMERCE_CODE')&&setting('WEBPAY_API_KEY'));}
export async function webpay(path:string,method='GET',payload?:unknown){
 if(!billingEnabled())throw new Error('Los pagos todavía no están habilitados. Puedes usar la demo o tu cuenta gratuita.');
 const production=setting('WEBPAY_ENV')==='production';
 const base=production?'https://webpay3g.transbank.cl':'https://webpay3gint.transbank.cl';
 const response=await fetch(`${base}/rswebpaytransaction/api/webpay/v1.2/transactions${path}`,{method,headers:{'Content-Type':'application/json','Tbk-Api-Key-Id':setting('WEBPAY_COMMERCE_CODE'),'Tbk-Api-Key-Secret':setting('WEBPAY_API_KEY')},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('No fue posible confirmar la operación con Webpay. Revisa el estado antes de volver a pagar.');return await response.json();
}
export function trustedCheckout(url:string){try{const u=new URL(url);return u.protocol==='https:'&&['webpay3g.transbank.cl','webpay3gint.transbank.cl'].includes(u.hostname);}catch{return false;}}

