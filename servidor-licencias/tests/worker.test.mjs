import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createHmac,createPublicKey,verify} from 'node:crypto';
import {createWorker} from '../src/worker.mjs';
import {DAY} from '../src/policy.mjs';
const migration=await readFile(new URL('../migrations/0001_licencias.sql',import.meta.url),'utf8');
function d1(){const db=new DatabaseSync(':memory:');db.exec(migration);const prepared=sql=>({bind(...args){return Object.assign(prepared(sql),{args});},args:[],async first(){return db.prepare(sql).get(...this.args)||null;},async all(){return {results:db.prepare(sql).all(...this.args)};},async run(){return db.prepare(sql).run(...this.args);}});return {raw:db,prepare:prepared,async batch(statements){db.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};}
function fixture(t){
 const DB=d1();t.after(()=>DB.raw.close());let now=Date.parse('2026-10-08T12:00:00Z');const payments=new Map(),calls=[];let intercept=()=>null;
 const env={DB,PUBLIC_BASE_URL:'https://license.example',PAYMENT_MODE:'test',MP_ACCESS_TOKEN:'test-fixture-not-a-real-credential',MP_WEBHOOK_SECRET:'test-secret'};
 const worker=createWorker({now:()=>now,fetcher:async(url,options)=>{
  calls.push({url,options});const overridden=await intercept(url,options);if(overridden)return overridden;const pathname=new URL(url).pathname;
  if(pathname==='/users/me')return Response.json({id:55});
  if(pathname==='/checkout/preferences')return Response.json({id:'pref-1',sandbox_init_point:'https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=pref-1',init_point:'https://www.mercadopago.cl/checkout/v1/redirect?pref_id=pref-1'});
  if(pathname==='/v1/payments/search')return Response.json({results:[...payments.values()].filter(p=>p.external_reference===new URL(url).searchParams.get('external_reference'))});
  if(pathname.startsWith('/v1/payments/'))return Response.json(payments.get(pathname.split('/').at(-1))||{}, {status:payments.has(pathname.split('/').at(-1))?200:404});
  throw Error('Unexpected API request');
 }});
 const deviceId='a'.repeat(64),secret='b'.repeat(64);
 const request=(path,body,headers={},method='POST')=>worker.fetch(new Request('https://license.example'+path,{method,headers:{'content-type':'application/json','x-device-id':deviceId,authorization:'Bearer '+secret,...headers},body:method==='GET'?undefined:JSON.stringify(body||{})}),env);
 const enroll=()=>request('/trial',{deviceId,secret});
 const checkout=async()=>{const response=await request('/checkout',{requestId:crypto.randomUUID(),amount:1});assert.equal(response.status,200);return response.json();};
 const payment=(order,id='123',overrides={})=>{const p={id:Number(id),external_reference:order.orderId,status:'approved',currency_id:'CLP',transaction_amount:9990,transaction_amount_refunded:0,collector_id:55,live_mode:false,...overrides};payments.set(id,p);return p;};
 const webhook=async id=>{const ts=String(Math.floor(now/1000)),rid='request-123',signature=createHmac('sha256',env.MP_WEBHOOK_SECRET).update(`id:${id};request-id:${rid};ts:${ts};`).digest('hex');return request('/webhooks/mercadopago?data.id='+id,{}, {'x-request-id':rid,'x-signature':`ts=${ts},v1=${signature}`});};
 const claims=result=>JSON.parse(Buffer.from(result.lease.split('.')[1],'base64url'));
 return {env,DB,request,enroll,checkout,payment,webhook,claims,calls,intercept:fn=>{intercept=fn;},advance:days=>now+=days*DAY};
}
test('Prueba de 15 días persistente; volver a registrar no reinicia el plazo',async t=>{const f=fixture(t);const initial=f.claims(await (await f.enroll()).json());f.advance(15);const repeat=f.claims(await (await f.enroll()).json());assert.equal(repeat.trialEndsAt,initial.trialEndsAt);assert.equal(repeat.canWrite,false);assert.equal(repeat.canRead,true);assert.equal(repeat.canExport,true);const different=await f.request('/trial',{deviceId:'a'.repeat(64),secret:'c'.repeat(64)});assert.equal(different.status,409);});
test('Checkout fija 9990 CLP, devuelve sandbox y reutiliza una compra pendiente',async t=>{const f=fixture(t);await f.enroll();const first=await f.checkout(),second=await f.checkout();assert.equal(first.orderId,second.orderId);assert.match(first.url,/sandbox/);const calls=f.calls.filter(c=>c.url.endsWith('/checkout/preferences'));assert.equal(calls.length,1);const body=JSON.parse(calls[0].options.body);assert.equal(body.items[0].unit_price,9990);assert.equal(body.items[0].currency_id,'CLP');assert.equal(body.notification_url,'https://license.example/webhooks/mercadopago');assert.equal(body.back_urls.success,'https://license.example/return');});
test('Pendiente o monto incorrecto no activan; pago confirmado extiende 30 días una sola vez',async t=>{const f=fixture(t);await f.enroll();f.advance(16);const order=await f.checkout();f.payment(order,'123',{status:'pending'});await f.webhook('123');let state=f.claims(await (await f.request('/status')).json());assert.equal(state.canWrite,false);f.payment(order,'123',{transaction_amount:1});await f.webhook('123');state=f.claims(await (await f.request('/status')).json());assert.equal(state.canWrite,false);f.payment(order);assert.equal((await f.webhook('123')).status,200);state=f.claims(await (await f.request('/status')).json());assert.equal(state.status,'active');assert.equal(state.paidUntil-state.iat*1000,30*DAY);await f.webhook('123');assert.equal(f.claims(await (await f.request('/status')).json()).paidUntil,state.paidUntil);f.advance(30);assert.equal(f.claims(await (await f.request('/status')).json()).canWrite,false);});
test('Una compra durante la prueba conserva los días de prueba restantes',async t=>{const f=fixture(t);await f.enroll();f.advance(2);const order=await f.checkout();f.payment(order);await f.webhook('123');const state=f.claims(await (await f.request('/status')).json());assert.equal(state.paidUntil-state.trialEndsAt,30*DAY);});
test('Regreso del navegador y webhook falsificado no conceden acceso',async t=>{const f=fixture(t);await f.enroll();f.advance(16);assert.equal((await f.request('/webhooks/mercadopago?data.id=123',{status:'approved'})).status,401);const response=await f.request('/return?status=approved&payment_id=123',null,{},'GET');assert.equal(response.status,200);assert.match(await response.text(),/no confirma/);assert.equal(f.claims(await (await f.request('/status')).json()).canWrite,false);});
test('Sin notificación, la consulta al proveedor recupera un pago aprobado',async t=>{const f=fixture(t);await f.enroll();f.advance(16);f.payment(await f.checkout());assert.equal(f.claims(await (await f.request('/status')).json()).status,'active');});
test('Reembolso bloquea edición, conserva respaldo y no se revierte con un evento antiguo',async t=>{const f=fixture(t);await f.enroll();const order=await f.checkout();f.payment(order);await f.webhook('123');f.payment(order,'123',{status:'refunded',transaction_amount_refunded:9990});await f.webhook('123');f.payment(order);await f.webhook('123');const s=f.claims(await (await f.request('/status')).json());assert.equal(s.canWrite,false);assert.equal(s.canExport,true);assert.equal((await f.request('/checkout',{requestId:crypto.randomUUID()})).status,409);});
test('La clave pública verifica la licencia y nunca revela la clave privada',async t=>{const f=fixture(t);const receipt=await (await f.enroll()).json(),key=await (await f.request('/public-key',null,{},'GET')).json();assert.equal(key.d,undefined);const [head,payload,sig]=receipt.lease.split('.');assert(verify(null,Buffer.from(head+'.'+payload),createPublicKey({key,format:'jwk'}),Buffer.from(sig,'base64url')));});
test('Credenciales incorrectas no consultan la licencia; producción requiere habilitación explícita',async t=>{const f=fixture(t);await f.enroll();assert.equal((await f.request('/status',{}, {authorization:'Bearer '+'0'.repeat(64)})).status,401);f.env.PAYMENT_MODE='production';assert.equal((await f.request('/checkout',{requestId:crypto.randomUUID()})).status,503);assert.equal(f.calls.length,0);});

test('URL pública mal configurada no deja una orden bloqueada',async t=>{
 const f=fixture(t);await f.enroll();delete f.env.PUBLIC_BASE_URL;
 const response=await f.request('/checkout',{requestId:crypto.randomUUID()});assert.equal(response.status,503);assert.match((await response.json()).error,/PUBLIC_BASE_URL/);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n,0);
});
test('Rechazo HTTP 401 de creación informa la causa y permite reintentar tras corregir credencial',async t=>{
 const f=fixture(t);await f.enroll();f.intercept(url=>url.endsWith('/checkout/preferences')?Response.json({message:'sensitive-provider-body'},{status:401}):null);
 const response=await f.request('/checkout',{requestId:crypto.randomUUID()});assert.equal(response.status,502);const error=(await response.json()).error;assert.match(error,/HTTP 401/);assert.match(error,/MP_ACCESS_TOKEN/);assert(!error.includes('sensitive-provider-body'));assert(!error.includes(f.env.MP_ACCESS_TOKEN));
 assert.equal(f.DB.raw.prepare('SELECT status FROM orders').get().status,'expired');f.intercept(()=>null);await f.checkout();
 assert.equal(f.DB.raw.prepare("SELECT COUNT(*) AS n FROM orders WHERE status='pending'").get().n,1);
});
test('Interrupción de creación se recupera con la misma orden y clave de idempotencia',async t=>{
 const f=fixture(t);await f.enroll();f.intercept(url=>{if(url.endsWith('/checkout/preferences'))throw Error('Network interrupted');});
 assert.equal((await f.request('/checkout',{requestId:crypto.randomUUID()})).status,502);const original=f.DB.raw.prepare('SELECT * FROM orders').get();assert.equal(original.status,'created');
 f.intercept(()=>null);const recovered=await f.checkout();assert.equal(recovered.orderId,original.id);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
 const posts=f.calls.filter(c=>c.url.endsWith('/checkout/preferences'));assert.equal(posts.length,2);assert.equal(posts[0].options.headers['X-Idempotency-Key'],posts[1].options.headers['X-Idempotency-Key']);
});
test('Consulta de pago rechazada preserva la orden y muestra HTTP sin borrar la prueba',async t=>{
 const f=fixture(t);await f.enroll();f.intercept(url=>{if(url.endsWith('/checkout/preferences'))throw Error('Network interrupted');});await f.request('/checkout',{requestId:crypto.randomUUID()});
 f.intercept(url=>url.includes('/v1/payments/search')?Response.json({error:'forbidden'},{status:403}):null);
 const response=await f.request('/checkout',{requestId:crypto.randomUUID()});assert.equal(response.status,502);assert.match((await response.json()).error,/HTTP 403/);
 const status=await (await f.request('/status')).json();assert(status.paymentCheckPending);assert.match(status.paymentCheckError,/HTTP 403/);assert.equal(f.claims(status).status,'trial');assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
});
test('Recuperación con pago pendiente no crea otro enlace ni concede acceso',async t=>{
 const f=fixture(t);await f.enroll();f.advance(16);f.intercept(url=>{if(url.endsWith('/checkout/preferences'))throw Error('Network interrupted');});await f.request('/checkout',{requestId:crypto.randomUUID()});
 const order=f.DB.raw.prepare('SELECT * FROM orders').get();f.payment({orderId:order.id},'123',{status:'pending'});f.intercept(()=>null);
 const response=await f.request('/checkout',{requestId:crypto.randomUUID()});assert.equal(response.status,409);assert.equal(f.calls.filter(c=>c.url.endsWith('/checkout/preferences')).length,1);assert.equal(f.claims(await (await f.request('/status')).json()).canWrite,false);
});
test('Dos recuperaciones simultáneas no crean dos preferencias',async t=>{
 const f=fixture(t);await f.enroll();f.intercept(url=>{if(url.endsWith('/checkout/preferences'))throw Error('Network interrupted');});await f.request('/checkout',{requestId:crypto.randomUUID()});
 let unlock,entered;const enteredPromise=new Promise(r=>entered=r);const wait=new Promise(r=>unlock=r);
 f.intercept(async url=>{if(url.endsWith('/checkout/preferences')){entered();await wait;}return null;});
 const first=f.request('/checkout',{requestId:crypto.randomUUID()});await enteredPromise;
 const second=await f.request('/checkout',{requestId:crypto.randomUUID()});assert.equal(second.status,409);unlock();assert.equal((await first).status,200);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/checkout/preferences')).length,2);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1);
});
test('Respuesta de búsqueda malformada no se interpreta como ausencia de pagos',async t=>{
 const f=fixture(t);await f.enroll();f.intercept(url=>{if(url.endsWith('/checkout/preferences'))throw Error('Network interrupted');});await f.request('/checkout',{requestId:crypto.randomUUID()});
 f.intercept(url=>url.includes('/v1/payments/search')?Response.json({unexpected:true}):null);
 assert.equal((await f.request('/checkout',{requestId:crypto.randomUUID()})).status,502);assert.equal(f.calls.filter(c=>c.url.endsWith('/checkout/preferences')).length,1);
});
