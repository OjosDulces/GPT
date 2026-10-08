import {adminClient,siteOrigin} from '../_shared/http.ts';
import {webpay} from '../_shared/webpay.ts';
import {validatePayment} from '../_shared/plans.js';
Deno.serve(async req=>{
 let outcome='pending',business='';
 try{
  if(!['GET','POST'].includes(req.method))return new Response('Método no permitido',{status:405});
  const input=req.method==='POST'?new URLSearchParams(await req.text()):new URL(req.url).searchParams;
  const aborted=!input.get('token_ws')&&input.has('TBK_TOKEN'),token=input.get('token_ws')||input.get('TBK_TOKEN');
  if(!token){outcome='pending';}
  else if(/^[a-zA-Z0-9_-]{10,160}$/.test(token)){
   const admin=adminClient(),{data:order,error}=await admin.from('billing_orders').select('*').eq('token',token).single();
   if(error||!order)throw new Error('Orden desconocida.');business=order.business_id;
   if(order.status==='paid')outcome='paid';
   else{
    let response;if(aborted)response=await webpay(`/${encodeURIComponent(token)}`);else{try{response=await webpay(`/${encodeURIComponent(token)}`,'PUT');}catch{response=await webpay(`/${encodeURIComponent(token)}`);}}
    if(validatePayment(order,response)){
     const {error:activate}=await admin.rpc('apply_verified_payment',{p_order_id:order.id,p_code:0});if(activate)throw new Error('Activación pendiente.');outcome='paid';
    }else if(aborted&&response.status==='INITIALIZED'){
     await admin.from('billing_orders').update({status:'cancelled'}).eq('id',order.id).neq('status','paid');outcome='cancelled';
    }else if(['FAILED','REVERSED','NULLIFIED'].includes(response.status)){
     await admin.from('billing_orders').update({status:'rejected',provider_code:response.response_code}).eq('id',order.id).neq('status','paid');outcome='rejected';
    }else if(response.status==='AUTHORIZED'){
     await admin.from('billing_orders').update({status:'review'}).eq('id',order.id).neq('status','paid');outcome='review';
    }
   }
  }
 }catch{outcome='pending';}
 return new Response(null,{status:303,headers:{Location:`${siteOrigin()}/app?billingResult=${outcome}${business?'&business='+encodeURIComponent(business):''}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
});
