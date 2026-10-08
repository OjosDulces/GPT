import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,generateKeyPairSync,verify} from 'node:crypto';
import {access,DAY,verifiedPayment,verifyWebhook,signLease} from '../src/policy.mjs';
const start=Date.parse('2026-10-01T12:00:00Z');
const license={trial_started_at:start,trial_ends_at:start+15*DAY,revoked:0};
test('15 días exactos; al vencer conserva lectura y exportación',()=>{
 assert.equal(access(license,null,start).canWrite,true);
 assert.equal(access(license,null,start+15*DAY-1).status,'trial');
 const expired=access(license,null,start+15*DAY);assert.equal(expired.status,'read_only');assert.equal(expired.canWrite,false);assert.equal(expired.canRead,true);assert.equal(expired.canExport,true);
});
test('Período pagado y revocación no eliminan lectura ni respaldo',()=>{
 const until=start+45*DAY;assert.equal(access(license,until,start+30*DAY).status,'active');assert.equal(access(license,until,until).status,'read_only');assert.equal(access({...license,revoked:1},until,start+DAY).canWrite,false);
});
const order={id:'order-1',amount:9990,currency:'CLP',duration_days:30};
const payment={id:123,status:'approved',external_reference:'order-1',transaction_amount:9990,currency_id:'CLP',collector_id:45,live_mode:false,transaction_amount_refunded:0};
test('Solo el pago aprobado, completo, del comercio y ambiente correctos habilita acceso',()=>{
 assert(verifiedPayment(payment,order,'45','test'));
 for(const patch of [{status:'pending'},{status:'rejected'},{status:'refunded'},{external_reference:'other'},{transaction_amount:1},{currency_id:'USD'},{collector_id:99},{live_mode:true},{transaction_amount_refunded:1}])assert.equal(verifiedPayment({...payment,...patch},order,'45','test'),false,JSON.stringify(patch));
 assert.equal(verifiedPayment(payment,{...order,amount:1},'45','test'),false);
});
test('Webhook exige firma válida, identificador de pago, solicitud y tiempo reciente',async()=>{
 const secret='solo-prueba',ts=String(Math.floor(start/1000)),id='123',requestId='req-test';
 const sig=createHmac('sha256',secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
 const req=new Request(`https://licenses.example/webhook?data.id=${id}`,{headers:{'x-request-id':requestId,'x-signature':`ts=${ts},v1=${sig}`}});
 assert(await verifyWebhook(req,secret,start));assert.equal(await verifyWebhook(req,'otro',start),false);assert.equal(await verifyWebhook(req,secret,start+11*60*1000),false);
 assert.equal(await verifyWebhook(new Request(req.url),secret,start),false);
});
test('Licencia emitida se verifica con clave pública; contenido alterado no verifica',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const token=await signLease({deviceId:'device',canWrite:true},privateKey.export({format:'jwk'}));
 const [header,payload,signature]=token.split('.');
 assert(verify(null,Buffer.from(header+'.'+payload),publicKey,Buffer.from(signature,'base64url')));
 assert.equal(verify(null,Buffer.from(header+'.'+Buffer.from('{"deviceId":"other"}').toString('base64url')),publicKey,Buffer.from(signature,'base64url')),false);
});
