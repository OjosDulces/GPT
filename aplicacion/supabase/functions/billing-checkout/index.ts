import {adminClient,body,cors,failure,identify,json,member,setting} from '../_shared/http.ts';
import {billingEnabled,webpay,trustedCheckout} from '../_shared/webpay.ts';
import {getPlan,validatePayment} from '../_shared/plans.js';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
 if(req.method!=='POST')return json(req,{error:'Método no permitido.'},405);
 try{
  const {client,user}=await identify(req),input=await body(req);await member(client,input.businessId,true);
  if(input.action==='capabilities')return json(req,{enabled:billingEnabled(),environment:setting('WEBPAY_ENV')==='production'?'production':'integration'});
  const admin=adminClient();
  if(input.action==='status'){
   const {data:order,error}=await admin.from('billing_orders').select('*').eq('id',input.orderId).eq('business_id',input.businessId).single();
   if(error||!order)throw new Error('Orden no encontrada.');
   if(!order.token&&order.status==='created'&&Date.now()-Date.parse(order.created_at)>120000){
    const {data:cancelled}=await admin.from('billing_orders').update({status:'cancelled'}).eq('id',order.id).eq('status','created').is('token',null).select('id');
    if(cancelled?.length)return json(req,{status:'cancelled'});
   }
   if(order.token&&order.status!=='paid'){
    const status=await webpay(`/${encodeURIComponent(order.token)}`);
    if(validatePayment(order,status)){const {error:saveError}=await admin.rpc('apply_verified_payment',{p_order_id:order.id,p_code:0});if(saveError)throw new Error('Pago autorizado; la activación requiere reintentar la comprobación.');return json(req,{status:'paid'});}
    if(['FAILED','REVERSED','NULLIFIED'].includes(status.status)){await admin.from('billing_orders').update({status:'rejected'}).eq('id',order.id).neq('status','paid');return json(req,{status:'rejected'});}
   }
   return json(req,{status:order.status});
  }
  if(!billingEnabled())throw new Error('Los pagos todavía no están habilitados.');
  const plan=getPlan(input.plan);if(!plan.price||plan.id!==input.plan)throw new Error('Plan no válido.');
  if(!/^[0-9a-f-]{36}$/i.test(input.requestId||''))throw new Error('Falta el identificador de la solicitud.');
  const {data:prior}=await admin.from('billing_orders').select('*').eq('user_id',user.id).eq('request_id',input.requestId).maybeSingle();
  if(prior){if(prior.business_id!==input.businessId||prior.plan!==plan.id)throw new Error('Solicitud reutilizada con otro contenido.');if(prior.status==='pending'&&prior.token&&trustedCheckout(prior.checkout_url))return json(req,{url:prior.checkout_url,token:prior.token,orderId:prior.id});throw new Error('Esta solicitud ya existe. Revisa su estado en el historial antes de iniciar otra.');}
  const {count}=await admin.from('billing_orders').select('id',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',new Date(Date.now()-3600000).toISOString());
  if((count||0)>=8)throw new Error('Demasiados intentos. Revisa los pagos pendientes o espera una hora.');
  const id=crypto.randomUUID(),buyOrder='CE'+id.replaceAll('-','').slice(0,24);
  const {error:insertError}=await admin.from('billing_orders').insert({id,business_id:input.businessId,user_id:user.id,request_id:input.requestId,plan:plan.id,amount:plan.price,buy_order:buyOrder});
  if(insertError)throw new Error('La solicitud ya fue recibida. Revisa el historial.');
  const created=await webpay('','POST',{buy_order:buyOrder,session_id:id,amount:plan.price,return_url:`${setting('SUPABASE_URL')}/functions/v1/webpay-return`});
  if(!created.token||!trustedCheckout(created.url))throw new Error('Webpay devolvió una respuesta inesperada.');
  const {error:saveError}=await admin.from('billing_orders').update({token:created.token,checkout_url:created.url,status:'pending'}).eq('id',id);
  if(saveError)throw new Error('No se pudo preparar el pago. No se realizó un cobro.');
  return json(req,{url:created.url,token:created.token,orderId:id});
 }catch(e){return failure(req,e);}
});
