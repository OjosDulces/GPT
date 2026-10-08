// Generado con node scripts/build-dashboard.mjs. Sin credenciales incluidas.
export const PRICE_CLP=9990, PERIOD_DAYS=30, TRIAL_DAYS=15, DAY=86400000;
export function access(license,paidUntil,now=Date.now()) {
 if(!license||!Number.isSafeInteger(now)||!Number.isSafeInteger(license.trial_started_at)||license.trial_ends_at!==license.trial_started_at+TRIAL_DAYS*DAY)throw Error('Invalid license record');
 const active=!license.revoked&&Number.isSafeInteger(paidUntil)&&paidUntil>now;
 const trial=!license.revoked&&license.trial_started_at<=now&&license.trial_ends_at>now;
 return {status:active?'active':trial?'trial':'read_only',canRead:true,canExport:true,canWrite:active||trial,trialEndsAt:license.trial_ends_at,paidUntil:paidUntil||null,writeUntil:active?paidUntil:trial?license.trial_ends_at:now};
}
export function verifiedPayment(payment,order,collectorId,mode) {
 return Boolean(payment&&order&&payment.status==='approved'&&payment.external_reference===order.id&&payment.currency_id==='CLP'&&payment.transaction_amount===PRICE_CLP&&order.amount===PRICE_CLP&&order.currency==='CLP'&&order.duration_days===PERIOD_DAYS&&String(payment.collector_id)===String(collectorId)&&typeof payment.live_mode==='boolean'&&payment.live_mode===(mode==='production')&&payment.transaction_amount_refunded===0&&/^\d+$/.test(String(payment.id)));
}
export function checkoutURL(value,mode) {
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['www.mercadopago.cl','www.mercadopago.com','sandbox.mercadopago.cl','sandbox.mercadopago.com'].includes(u.hostname)&&u.pathname.startsWith('/checkout/');}catch{return false;}
}
const bytes=value=>new TextEncoder().encode(value);
const base64url=data=>btoa(String.fromCharCode(...new Uint8Array(data))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function sha256(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(value))),n=>n.toString(16).padStart(2,'0')).join('');}
export async function signLease(claims,privateJWK) {
 const jwk=typeof privateJWK==='string'?JSON.parse(privateJWK):privateJWK;
 if(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||!jwk.d)throw Error('Signing key unavailable');
 const key=await crypto.subtle.importKey('jwk',jwk,'Ed25519',false,['sign']);
 const input=base64url(bytes(JSON.stringify({alg:'EdDSA',typ:'JWT'})))+'.'+base64url(bytes(JSON.stringify(claims)));
 return input+'.'+base64url(await crypto.subtle.sign('Ed25519',key,bytes(input)));
}
export async function verifyWebhook(request,secret,now=Date.now()) {
 if(!secret)return false;
 const url=new URL(request.url),id=url.searchParams.get('data.id'),requestId=request.headers.get('x-request-id');
 if(!id||!/^\d+$/.test(id)||!requestId||!/^[-a-zA-Z0-9]+$/.test(requestId))return false;
 const pairs=(request.headers.get('x-signature')||'').split(',').map(s=>s.trim().split('='));
 if(pairs.filter(([k])=>k==='ts').length!==1||pairs.filter(([k])=>k==='v1').length!==1)return false;
 const parts=Object.fromEntries(pairs),ts=parts.ts,signature=parts.v1;
 if(!/^\d{10,13}$/.test(ts||'')||!/^\w{64}$/.test(signature||'')||!/^[a-f0-9]+$/i.test(signature))return false;
 const timestamp=Number(ts)*(ts.length===10?1000:1);
 if(Math.abs(now-timestamp)>10*60*1000)return false;
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const raw=Uint8Array.from(signature.match(/../g),n=>parseInt(n,16));
 return crypto.subtle.verify('HMAC',key,raw,bytes(`id:${id};request-id:${requestId};ts:${ts};`));
}

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class PublicError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const token=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const mode=env=>env.PAYMENT_MODE==='production'?'production':'test';
function origin(env){const u=new URL(env.PUBLIC_BASE_URL);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Invalid public origin');return u.origin;}
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
async function mp(env,path,method='GET',body,requestId,fetcher=fetch){
 if(!env.MP_ACCESS_TOKEN)throw new PublicError('Los pagos de prueba aún no están configurados.',503);
 const headers={'Authorization':'Bearer '+env.MP_ACCESS_TOKEN,'Content-Type':'application/json'};
 if(requestId)headers['X-Idempotency-Key']=requestId;
 const response=await fetcher('https://api.mercadopago.com'+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new PublicError('No pudimos consultar Mercado Pago. Comprueba el estado antes de volver a pagar.',502);
 return response.json();
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
   const search=await mp(env,'/v1/payments/search?external_reference='+encodeURIComponent(order.id),'GET',undefined,undefined,fetcher);
   for(const p of (search.results||[]).slice(0,10))await verifyAndApply(env,p.id,now,fetcher);
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
   if(url.pathname==='/health'&&request.method==='GET')return json({service:'Control Emprende · Licencias',mode:mode(env),trialDays:TRIAL_DAYS,priceCLP:PRICE_CLP,periodDays:PERIOD_DAYS,billingEnabled:billingReady(env)});
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
    let paymentCheckPending=false;try{await reconcile(env,license,time,fetcher);}catch{paymentCheckPending=true;}
    return json({...await lease(env,license,time),paymentCheckPending});
   }
   if(url.pathname==='/checkout'){
    if(!billingReady(env))throw new PublicError('La compra todavía no está habilitada. Tus datos se conservan.',503);
    if(license.revoked)throw new PublicError('La licencia requiere revisión. Contacta al proveedor.',409);
    const body=await input(request);if(!uuid(body.requestId))throw new PublicError('Solicitud de compra inválida.');
    await limit(env,'checkout:'+license.id,12,time);
    // A second click reuses an existing checkout. It never trusts a client-supplied amount.
    const prior=await env.DB.prepare('SELECT * FROM orders WHERE license_id=? AND request_id=?').bind(license.id,body.requestId).first();
    if(prior){if(prior.status==='pending'&&prior.expires_at>time&&checkoutURL(prior.checkout_url,mode(env)))return json({url:prior.checkout_url,orderId:prior.id,mode:mode(env)});throw new PublicError('La solicitud ya existe. Comprueba su estado antes de volver a pagar.',409);}
    await env.DB.prepare("UPDATE orders SET status='expired' WHERE license_id=? AND status IN ('created','pending') AND expires_at<=?").bind(license.id,time).run();
    const pending=await env.DB.prepare("SELECT * FROM orders WHERE license_id=? AND status IN ('created','pending','review')").bind(license.id).first();
    if(pending){if(pending.status==='pending'&&checkoutURL(pending.checkout_url,mode(env)))return json({url:pending.checkout_url,orderId:pending.id,mode:mode(env)});throw new PublicError('Hay una compra pendiente de comprobar. No se ha iniciado otra.',409);}
    const id=crypto.randomUUID(),expires=time+3600000;
    try{await env.DB.prepare('INSERT INTO orders(id,license_id,request_id,amount,currency,duration_days,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,license.id,body.requestId,PRICE_CLP,'CLP',PERIOD_DAYS,time,expires).run();}catch{throw new PublicError('Ya hay una compra en proceso. Comprueba su estado.',409);}
    const base=origin(env),preference=await mp(env,'/checkout/preferences','POST',{items:[{id:'ce-30-days',title:'Control Emprende · 30 días',quantity:1,currency_id:'CLP',unit_price:PRICE_CLP}],external_reference:id,notification_url:base+'/webhooks/mercadopago',back_urls:{success:base+'/return',pending:base+'/return',failure:base+'/return'},auto_return:'approved',expires:true,expiration_date_from:new Date(time).toISOString(),expiration_date_to:new Date(expires).toISOString()},id,fetcher);
    const checkout=mode(env)==='production'?preference.init_point:preference.sandbox_init_point;
    if(!preference.id||!checkoutURL(checkout,mode(env)))throw new PublicError('Mercado Pago no devolvió una página de pago válida.',502);
    await env.DB.prepare("UPDATE orders SET preference_id=?,checkout_url=?,status='pending' WHERE id=? AND status='created'").bind(String(preference.id),checkout,id).run();
    return json({url:checkout,orderId:id,mode:mode(env)});
   }
   return json({error:'Ruta no disponible.'},404);
  }catch(error){return json({error:error instanceof PublicError?error.message:'El servicio no pudo completar la operación. Tus datos se conservan.'},error instanceof PublicError?error.status:503);}
 }};
}
export default createWorker();
