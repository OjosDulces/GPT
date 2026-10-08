import {PRICE_CLP,PERIOD_DAYS,TRIAL_DAYS,DAY,access,sha256,signLease,verifiedPayment,checkoutURL,verifyWebhook} from './policy.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class PublicError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const token=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const mode=env=>env.PAYMENT_MODE==='production'?'production':'test';
function origin(env){try{const u=new URL(env.PUBLIC_BASE_URL);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error();return u.origin;}catch{throw new PublicError('Revisa PUBLIC_BASE_URL en Cloudflare: debe ser la dirección HTTPS del Worker, sin rutas adicionales.',503);}}
function billingReady(env){return Boolean(env.MP_ACCESS_TOKEN&&env.MP_WEBHOOK_SECRET&&(mode(env)!=='production'||env.ENABLE_PRODUCTION_PAYMENTS==='true'));}
async function input(request){if(Number(request.headers.get('content-length'))>4096)throw new PublicError('Solicitud demasiado grande.',413);const raw=await request.text();if(raw.length>4096)throw new PublicError('Solicitud demasiado grande.',413);try{return JSON.parse(raw);}catch{throw new PublicError('Solicitud inválida.');}}
async function key(env){
 let row=await env.DB.prepare("SELECT private_jwk FROM server_keys WHERE id='primary'").first();
 if(!row){const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);if(!('privateKey' in pair))throw Error('No se generó un par de claves.');const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);await env.DB.prepare("INSERT OR IGNORE INTO server_keys(id,private_jwk) VALUES('primary',?)").bind(JSON.stringify(jwk)).run();row=await env.DB.prepare("SELECT private_jwk FROM server_keys WHERE id='primary'").first();}
 return JSON.parse(row.private_jwk);
}
async function limit(env,id,max,now){
 const bucket=Math.floor(now/3600000),key=id+':'+bucket;
 const r=await env.DB.prepare('INSERT INTO request_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key,(bucket+2)*3600000).first();
 if(r.count>max)throw new PublicError('Demasiados intentos. Espera una hora antes de volver a intentarlo.',429);
 await env.DB.prepare('DELETE FROM request_limits WHERE expires_at<?').bind(now).run();
}
async function identify(request,env){
 const device=request.headers.get('x-device-id'),secret=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(!token(device)||!token(secret))throw new PublicError('La licencia de este equipo no está disponible.',401);
 const row=await env.DB.prepare('SELECT * FROM licenses WHERE device_id=? AND token_hash=?').bind(device,await sha256(secret)).first();
 if(!row)throw new PublicError('No pudimos identificar la licencia de este equipo.',401);return row;
}
class MercadoPagoError extends PublicError {constructor(message,httpStatus){super(message,502);this.httpStatus=httpStatus;}}
async function mp(env,path,method='GET',body,requestId,fetcher=fetch){
 if(!env.MP_ACCESS_TOKEN)throw new PublicError('Los pagos de prueba aún no están configurados.',503);
 const headers={'Authorization':'Bearer '+env.MP_ACCESS_TOKEN,'Content-Type':'application/json'};
 if(requestId)headers['X-Idempotency-Key']=requestId;
 const operation=path.startsWith('/checkout/preferences')?'crear el enlace de pago':path==='/users/me'?'comprobar la cuenta vendedora':'consultar el pago';
 let response;try{response=await fetcher('https://api.mercadopago.com'+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new PublicError('Mercado Pago no respondió al '+operation+'. Vuelve a comprobarlo; se conservará el mismo intento.',502);}
 if(!response.ok){
  const hint=[401,403].includes(response.status)?' Revisa que MP_ACCESS_TOKEN sea el Access Token del vendedor y corresponda al ambiente configurado. No uses la Public Key ni el secreto del webhook.':response.status===429?' Espera unos minutos antes de reintentar.':'';
  throw new MercadoPagoError('Mercado Pago rechazó la solicitud para '+operation+' (HTTP '+response.status+').'+hint,response.status);
 }
 try{return await response.json();}catch{throw new PublicError('Mercado Pago devolvió una respuesta inválida al '+operation+'. Se conservará el mismo intento.',502);}
}
async function searchPayments(env,order,fetcher){
 const result=await mp(env,'/v1/payments/search?external_reference='+encodeURIComponent(order.id),'GET',undefined,undefined,fetcher);
 if(!Array.isArray(result.results))throw new PublicError('No pudimos comprobar los pagos de este intento. No se creará otra compra hasta poder consultarlos.',502);
 return result.results;
}
async function createCheckout(env,order,now,fetcher,{recover=false}={}){
 // Persisted lock survives concurrent requests and expires after interrupted executions.
 const lockId='checkout-lock:'+order.id,nonce=Math.floor(Math.random()*Number.MAX_SAFE_INTEGER);
 const lock=await env.DB.prepare('INSERT INTO request_limits(id,count,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET count=excluded.count,expires_at=excluded.expires_at WHERE request_limits.expires_at<=? RETURNING count').bind(lockId,nonce,now+60000,now).first();
 if(!lock)throw new PublicError('El enlace de esta compra se está preparando. Espera un minuto y vuelve a intentarlo.',409);
 try{
  order=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(order.id).first();
  if(order.status==='pending'&&order.expires_at>now&&checkoutURL(order.checkout_url,mode(env)))return {url:order.checkout_url,orderId:order.id,mode:mode(env)};
  if(order.status!=='created')throw new PublicError('Comprueba el estado del pago antes de volver a comprar.',409);
  if(recover){
   const payments=await searchPayments(env,order,fetcher);
   for(const payment of payments.slice(0,10))await verifyAndApply(env,payment.id,now,fetcher);
   if(payments.length)throw new PublicError('Este intento ya tiene un pago registrado. Pulsa Comprobar licencia y pago antes de volver a comprar.',409);
  }
  const base=origin(env),expires=order.expires_at;
  let preference;
  try{preference=await mp(env,'/checkout/preferences','POST',{items:[{id:'ce-30-days',title:'Control Emprende · 30 días',quantity:1,currency_id:'CLP',unit_price:PRICE_CLP}],external_reference:order.id,notification_url:base+'/webhooks/mercadopago',back_urls:{success:base+'/return',pending:base+'/return',failure:base+'/return'},auto_return:'approved',expires:true,expiration_date_from:new Date(order.created_at).toISOString(),expiration_date_to:new Date(expires).toISOString()},order.id,fetcher);}catch(error){
   // A definitive rejected creation has no payable URL. Never erase an ambiguous timeout or 5xx.
   if(!recover&&error instanceof MercadoPagoError&&[400,401,403,404,422].includes(error.httpStatus))await env.DB.prepare("UPDATE orders SET status='expired' WHERE id=? AND status='created' AND preference_id IS NULL").bind(order.id).run();
   throw error;
  }
  const checkout=mode(env)==='production'?preference.init_point:preference.sandbox_init_point;
  if(!preference.id||!checkoutURL(checkout,mode(env)))throw new PublicError('Mercado Pago no devolvió una página de pago válida. Comprueba las credenciales del ambiente configurado.',502);
  await env.DB.prepare("UPDATE orders SET preference_id=?,checkout_url=?,status='pending' WHERE id=? AND status='created'").bind(String(preference.id),checkout,order.id).run();
  return {url:checkout,orderId:order.id,mode:mode(env)};
 }finally{await env.DB.prepare('DELETE FROM request_limits WHERE id=? AND count=?').bind(lockId,nonce).run();}
}
async function verifyAndApply(env,id,now,fetcher){
 if(!/^\d+$/.test(String(id)))throw new PublicError('Identificador de pago inválido.');
 const payment=await mp(env,'/v1/payments/'+id,'GET',undefined,undefined,fetcher);
 if(String(payment.id)!==String(id)||!uuid(payment.external_reference))return 'ignored';
 const order=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(payment.external_reference).first();
 if(!order)return 'ignored';
 const merchant=await mp(env,'/users/me','GET',undefined,undefined,fetcher);
 if(!merchant.id||String(payment.collector_id)!==String(merchant.id)||payment.live_mode!==(mode(env)==='production'))return 'ignored';
 if(['refunded','charged_back'].includes(payment.status)||payment.transaction_amount_refunded>0){
  const stored=await env.DB.prepare('SELECT * FROM payments WHERE id=? AND order_id=?').bind(String(id),order.id).first();
  if(stored)await env.DB.batch([
   env.DB.prepare('UPDATE payments SET revoked_at=? WHERE id=?').bind(now,String(id)),
   env.DB.prepare('UPDATE licenses SET revoked=1 WHERE id=?').bind(order.license_id),
   env.DB.prepare("UPDATE orders SET status='refunded' WHERE id=?").bind(order.id)
  ]);
  return 'refunded';
 }
 if(!verifiedPayment(payment,order,merchant.id,mode(env))){
  if(payment.status==='approved')await env.DB.prepare("UPDATE orders SET status='review' WHERE id=? AND status NOT IN ('paid','refunded')").bind(order.id).run();
  return 'pending';
 }
 // Both inserts and updates run in one transaction. One order grants one period, even for duplicate webhooks.
 await env.DB.batch([
  env.DB.prepare(`INSERT OR IGNORE INTO payments(id,order_id,license_id,verified_at,starts_at,ends_at)
   SELECT ?,o.id,o.license_id,?,MAX(?,l.trial_ends_at,COALESCE((SELECT MAX(ends_at) FROM payments WHERE license_id=o.license_id AND revoked_at IS NULL),0)),MAX(?,l.trial_ends_at,COALESCE((SELECT MAX(ends_at) FROM payments WHERE license_id=o.license_id AND revoked_at IS NULL),0))+2592000000
   FROM orders o JOIN licenses l ON l.id=o.license_id WHERE o.id=? AND l.revoked=0`).bind(String(id),now,now,now,order.id),
  env.DB.prepare("UPDATE orders SET status='paid' WHERE id=? AND EXISTS(SELECT 1 FROM payments WHERE order_id=orders.id AND revoked_at IS NULL)").bind(order.id)
 ]);
 const applied=await env.DB.prepare('SELECT id FROM payments WHERE order_id=?').bind(order.id).first();
 // An unexpected second approved payment requires review, never another entitlement.
 return applied?.id===String(id)?'paid':'review';
}
async function reconcile(env,license,now,fetcher){
 if(!env.MP_ACCESS_TOKEN)return;
 const rows=await env.DB.prepare("SELECT * FROM orders WHERE license_id=? AND status IN ('created','pending','expired','review','paid') ORDER BY created_at DESC LIMIT 8").bind(license.id).all();
 for(const order of rows.results){
  if(order.status==='paid'){
   const p=await env.DB.prepare('SELECT id FROM payments WHERE order_id=?').bind(order.id).first();if(p)await verifyAndApply(env,p.id,now,fetcher);
  }else{
   const payments=await searchPayments(env,order,fetcher);
   for(const p of payments.slice(0,10))await verifyAndApply(env,p.id,now,fetcher);
  }
 }
}
async function lease(env,license,now){
 license=await env.DB.prepare('SELECT * FROM licenses WHERE id=?').bind(license.id).first();
 const row=await env.DB.prepare('SELECT MAX(ends_at) AS paid_until FROM payments WHERE license_id=? AND revoked_at IS NULL').bind(license.id).first();
 const state=access(license,row.paid_until,now),jwk=await key(env);
 const payload={iss:'control-emprende-licenses',aud:'control-emprende-desktop',v:1,deviceId:license.device_id,licenseId:license.id,mode:mode(env),iat:Math.floor(now/1000),exp:Math.floor((now+7*DAY)/1000),...state};
 return {lease:await signLease(payload,jwk),price:PRICE_CLP,currency:'CLP',periodDays:PERIOD_DAYS,billingEnabled:billingReady(env)};
}
export function createWorker({now=()=>Date.now(),fetcher=(input,init)=>fetch(input,init)}={}){
 return {async fetch(request,env){
  const url=new URL(request.url),time=now();
  try{
   if(url.pathname==='/health'&&request.method==='GET')return json({service:'Control Emprende · Licencias',revision:'checkout-recovery-1',mode:mode(env),trialDays:TRIAL_DAYS,priceCLP:PRICE_CLP,periodDays:PERIOD_DAYS,billingEnabled:billingReady(env)});
   if(url.pathname==='/public-key'&&request.method==='GET'){const k=await key(env);return json({kty:k.kty,crv:k.crv,x:k.x});}
   if(url.pathname==='/return'&&['GET','POST'].includes(request.method))return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Control Emprende</title><h1>Vuelve a Control Emprende</h1><p>La aplicación comprobará el resultado con Mercado Pago. Esta pantalla no confirma que hayas pagado.</p><p>Si el pago está pendiente, espera su confirmación antes de iniciar otra compra.</p></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});
   if(request.method!=='POST')return json({error:'Ruta o método no disponible.'},404);
   if(url.pathname==='/webhooks/mercadopago'){
    if(!await verifyWebhook(request,env.MP_WEBHOOK_SECRET,time))throw new PublicError('Notificación no verificada.',401);
    const result=await verifyAndApply(env,url.searchParams.get('data.id'),time,fetcher);return json({received:true,result});
   }
   if(request.headers.has('origin'))throw new PublicError('Esta ruta se usa desde la aplicación de escritorio.',403);
   if(url.pathname==='/trial'){
    await limit(env,'trial:'+await sha256(request.headers.get('cf-connecting-ip')||'unknown'),20,time);
    const body=await input(request);if(!token(body.deviceId)||!token(body.secret))throw new PublicError('Identificador de equipo inválido.');
    await env.DB.prepare('INSERT OR IGNORE INTO licenses(id,device_id,token_hash,trial_started_at,trial_ends_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),body.deviceId,await sha256(body.secret),time,time+TRIAL_DAYS*DAY).run();
    const row=await env.DB.prepare('SELECT * FROM licenses WHERE device_id=? AND token_hash=?').bind(body.deviceId,await sha256(body.secret)).first();
    if(!row)throw new PublicError('Este equipo ya tiene una licencia. Conserva sus datos de activación o solicita recuperación.',409);
    return json(await lease(env,row,time));
   }
   const license=await identify(request,env);
   if(url.pathname==='/status'){
    await limit(env,'status:'+license.id,240,time);
    let paymentCheckPending=false,paymentCheckError='';try{await reconcile(env,license,time,fetcher);}catch(error){paymentCheckPending=true;paymentCheckError=error instanceof PublicError?error.message:'No se pudo comprobar el pago.';}
    return json({...await lease(env,license,time),paymentCheckPending,paymentCheckError});
   }
   if(url.pathname==='/checkout'){
    if(!billingReady(env))throw new PublicError('La compra todavía no está habilitada. Tus datos se conservan.',503);
    if(license.revoked)throw new PublicError('La licencia requiere revisión. Contacta al proveedor.',409);
    origin(env); // Validate configuration before inserting an order.
    const body=await input(request);if(!uuid(body.requestId))throw new PublicError('Solicitud de compra inválida.');
    await limit(env,'checkout:'+license.id,12,time);
    // A second click reuses an existing checkout. It never trusts a client-supplied amount.
    const prior=await env.DB.prepare('SELECT * FROM orders WHERE license_id=? AND request_id=?').bind(license.id,body.requestId).first();
    if(prior){if(prior.status==='created'&&prior.expires_at>time)return json(await createCheckout(env,prior,time,fetcher,{recover:true}));if(prior.status==='pending'&&prior.expires_at>time&&checkoutURL(prior.checkout_url,mode(env)))return json({url:prior.checkout_url,orderId:prior.id,mode:mode(env)});throw new PublicError('La solicitud ya existe. Comprueba su estado antes de volver a pagar.',409);}
    await env.DB.prepare("UPDATE orders SET status='expired' WHERE license_id=? AND status IN ('created','pending') AND expires_at<=?").bind(license.id,time).run();
    const pending=await env.DB.prepare("SELECT * FROM orders WHERE license_id=? AND status IN ('created','pending','review')").bind(license.id).first();
    if(pending){if(pending.status==='created')return json(await createCheckout(env,pending,time,fetcher,{recover:true}));if(pending.status==='pending'&&checkoutURL(pending.checkout_url,mode(env)))return json({url:pending.checkout_url,orderId:pending.id,mode:mode(env)});throw new PublicError('Hay una compra pendiente de comprobar. No se ha iniciado otra.',409);}
    const id=crypto.randomUUID(),expires=time+3600000;
    try{await env.DB.prepare('INSERT INTO orders(id,license_id,request_id,amount,currency,duration_days,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,license.id,body.requestId,PRICE_CLP,'CLP',PERIOD_DAYS,time,expires).run();}catch{throw new PublicError('Ya hay una compra en proceso. Comprueba su estado.',409);}
    const order=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
    return json(await createCheckout(env,order,time,fetcher));
   }
   return json({error:'Ruta no disponible.'},404);
  }catch(error){return json({error:error instanceof PublicError?error.message:'El servicio no pudo completar la operación. Tus datos se conservan.'},error instanceof PublicError?error.status:503);}
 }};
}
export default createWorker();
