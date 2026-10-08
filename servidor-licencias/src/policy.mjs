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
