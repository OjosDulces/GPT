import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {validatePayment} from '../supabase/functions/_shared/plans.js';

async function handler(name,deps){
 const source=stripTypeScriptTypes(await readFile(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
 let run;new Function('Deno',...Object.keys(deps),source)({serve:fn=>run=fn},...Object.values(deps));return run;
}
const order={id:'00000000-0000-4000-8000-000000000099',business_id:'00000000-0000-4000-8000-000000000011',amount:9990,buy_order:'CE_TEST',status:'pending'};
const authorized={status:'AUTHORIZED',response_code:0,amount:9990,buy_order:'CE_TEST',session_id:order.id};
async function callback(response,{aborted=false,timeout=false,paid=false}={}){
 const updates=[],calls=[];let activated=0;
 const admin={from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{...order,status:paid?'paid':'pending'}}),update(value){updates.push(value);return this;},neq:async()=>({error:null})}),rpc:async()=>{activated++;return {error:null};}};
 const run=await handler('webpay-return',{adminClient:()=>admin,siteOrigin:()=>'https://negocio.example',validatePayment,webpay:async(path,method='GET')=>{calls.push(method);if(timeout&&method==='PUT')throw new Error('timeout');return response;}});
 const result=await run(new Request(`https://functions.example/return?${aborted?'TBK_TOKEN':'token_ws'}=token_de_prueba_123456&redirect=https://evil.example`));
 return {updates,calls,activated,result};
}
test('Callback: activa solo la transacción verificada y redirige al origen fijo',async()=>{const r=await callback(authorized);assert.equal(r.activated,1);assert.deepEqual(r.calls,['PUT']);const url=new URL(r.result.headers.get('location'));assert.equal(url.origin,'https://negocio.example');assert.equal(url.searchParams.get('billingResult'),'paid');assert.equal(url.searchParams.get('business'),order.business_id);});
test('Callback: monto distinto deja revisión y no activa el plan',async()=>{const r=await callback({...authorized,amount:100});assert.equal(r.activated,0);assert.equal(r.updates[0].status,'review');});
test('Callback: una cancelación consulta Webpay sin confirmar el cargo',async()=>{const r=await callback({status:'INITIALIZED'},{aborted:true});assert.deepEqual(r.calls,['GET']);assert.equal(r.activated,0);assert.equal(r.updates[0].status,'cancelled');});
test('Callback: ante respuesta incierta consulta el estado antes de activar',async()=>{const r=await callback(authorized,{timeout:true});assert.deepEqual(r.calls,['PUT','GET']);assert.equal(r.activated,1);});
test('Callback: repetir el retorno de una orden pagada no vuelve a activarla',async()=>{const r=await callback(authorized,{paid:true});assert.equal(r.activated,0);assert.equal(r.calls.length,0);});
test('Checkout: un integrante sin propiedad no llega al servicio de cobro',async()=>{let accessed=false;const run=await handler('billing-checkout',{identify:async()=>({client:{},user:{id:'member'}}),body:async()=>({businessId:order.business_id}),member:async()=>{throw new Error('Solo el propietario');},failure:(req,e)=>Response.json({error:e.message},{status:400}),adminClient:()=>{accessed=true;},cors:()=>({}),json:(req,data,status=200)=>Response.json(data,{status}),billingEnabled:()=>true});const response=await run(new Request('https://functions.example/billing',{method:'POST'}));assert.equal(response.status,400);assert.equal(accessed,false);assert.match((await response.json()).error,/propietario/);});
