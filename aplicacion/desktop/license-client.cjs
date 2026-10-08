'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomBytes,createHash,createPublicKey,verify}=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const DAY=86400000;
function validateConfig(value,{test=false}={}){
 const u=new URL(value.server);
 if((u.protocol!=='https:'&&!(test&&u.protocol==='http:'&&u.hostname==='127.0.0.1'))||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Servidor de licencias inválido.');
 if(!['test','production'].includes(value.mode)||value.publicKey?.kty!=='OKP'||value.publicKey?.crv!=='Ed25519'||!/^[A-Za-z0-9_-]{43}$/.test(value.publicKey?.x||'')||value.publicKey.d)throw Error('Configuración pública de licencia inválida.');
 return {...value,server:u.origin,verificationKey:createPublicKey({key:value.publicKey,format:'jwk'})};
}
function decodeLease(value,config,deviceId){
 if(typeof value!=='string'||value.length>16384||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(value))throw Error('Autorización de licencia inválida.');
 const [h,p,s]=value.split('.'),header=JSON.parse(Buffer.from(h,'base64url').toString());
 if(header.alg!=='EdDSA'||header.typ!=='JWT'||!verify(null,Buffer.from(h+'.'+p),config.verificationKey,Buffer.from(s,'base64url')))throw Error('La firma de la licencia no es válida.');
 const c=JSON.parse(Buffer.from(p,'base64url').toString());
 if(c.iss!=='control-emprende-licenses'||c.aud!=='control-emprende-desktop'||c.v!==1||c.deviceId!==deviceId||c.mode!==config.mode||!['trial','active','read_only'].includes(c.status)||typeof c.canWrite!=='boolean'||![c.iat,c.exp,c.writeUntil,c.trialEndsAt].every(Number.isSafeInteger)||c.exp<=c.iat||c.exp-c.iat>7*86400+1||c.writeUntil<0||c.trialEndsAt<0||(c.paidUntil!==null&&!Number.isSafeInteger(c.paidUntil)))throw Error('La licencia no corresponde a este equipo o ambiente.');
 if(c.canWrite&&(c.status==='read_only'||c.writeUntil>(c.status==='trial'?c.trialEndsAt:c.paidUntil)))throw Error('Período de licencia inválido.');
 return c;
}
async function windowsDeviceId(){
 const {stdout}=await promisify(execFile)('reg.exe',['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid','/reg:64'],{windowsHide:true,timeout:8000});
 const guid=stdout.match(/MachineGuid\s+REG_SZ\s+([0-9a-f-]{36})/i)?.[1];
 if(!guid)throw Error('No pudimos identificar este equipo para activar la prueba.');
 return createHash('sha256').update('control-emprende-device-v1:'+guid.toLowerCase()).digest('hex');
}
function checkoutAllowed(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['www.mercadopago.cl','www.mercadopago.com','sandbox.mercadopago.cl','sandbox.mercadopago.com'].includes(u.hostname)&&u.pathname.startsWith('/checkout/');}catch{return false;}}
function createLicenseClient({dir,config,safeStorage,getDeviceId=windowsDeviceId,fetcher=fetch,clock=Date.now,monotonic=()=>performance.now(),test=false,onChange=()=>{}}){
 const cfg=validateConfig(config,{test}),file=path.join(dir,'license-v1.enc');
 let storageFailed=false;
 let state,claims,initPromise,inFlight,lastError='',billingEnabled=false,paymentCheckPending=false,anchor,anchorMono,lastPersist=0,lastAttempt=0;
 let persistence=Promise.resolve();
 const persist=()=>{const snapshot=JSON.stringify(state);persistence=persistence.catch(()=>{}).then(async()=>{if(!safeStorage.isEncryptionAvailable())throw Error('No está disponible el almacenamiento seguro de Windows.');await fs.mkdir(dir,{recursive:true});await fs.writeFile(file+'.tmp',safeStorage.encryptString(snapshot),{mode:0o600});await fs.rename(file+'.tmp',file);});return persistence.then(()=>{storageFailed=false;},e=>{storageFailed=true;throw e;});};
 async function init(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
   if(!safeStorage.isEncryptionAvailable())throw Error('No está disponible el almacenamiento seguro de Windows.');
   let raw;try{raw=await fs.readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
   const deviceId=await getDeviceId();if(!/^[a-f0-9]{64}$/.test(deviceId))throw Error('Identificador de equipo inválido.');
   if(raw){
    if(raw.length>65536)throw Error('Los datos de activación no se pueden leer.');
    state=JSON.parse(safeStorage.decryptString(raw));
    if(state.v!==1||state.deviceId!==deviceId||!Number.isSafeInteger(state.lastSeen)||!/^[a-f0-9]{64}$/.test(state.secret))throw Error('Los datos de activación no corresponden a este equipo.');
    if(state.lease)claims=decodeLease(state.lease,cfg,deviceId);
   }else{state={v:1,deviceId,secret:randomBytes(32).toString('hex'),lastSeen:clock(),lease:null};await persist();}
   anchor=Math.max(clock(),state.lastSeen,claims?claims.iat*1000:0);anchorMono=monotonic();
  })();
  return initPromise;
 }
 function current(){
  const now=Math.max(clock(),anchor===undefined?0:anchor+Math.max(0,monotonic()-anchorMono),state?.lastSeen||0);
  const rollback=Boolean(state&&clock()+300000<state.lastSeen);
  const currentLease=claims&&claims.iat*1000<=now+300000&&claims.exp*1000>now;
  const canWrite=Boolean(currentLease&&claims.canWrite&&claims.writeUntil>now&&!rollback&&!storageFailed);
  return {status:canWrite?claims.status:'read_only',canWrite,canRead:true,canExport:true,mode:cfg.mode,trialEndsAt:claims?.trialEndsAt||null,paidUntil:claims?.paidUntil||null,verifyBefore:claims?.exp?claims.exp*1000:null,daysRemaining:canWrite?Math.max(0,Math.ceil((claims.writeUntil-now)/DAY)):0,billingEnabled,paymentCheckPending,checking:Boolean(inFlight),error:rollback?'Revisa la fecha y hora del equipo y vuelve a comprobar la licencia.':lastError,reason:canWrite?'':!claims?'Conéctate a Internet para iniciar o comprobar tu licencia.':!currentLease?'Conéctate a Internet para volver a comprobar tu licencia.':rollback?'Revisa la fecha y hora del equipo.':'Terminó tu período de acceso. Puedes consultar y respaldar tus datos.',priceCLP:9990,periodDays:30,now};
 }
 const publish=()=>onChange(current());
 async function request(route,body){
  const response=await fetcher(cfg.server+route,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.secret,'X-Device-ID':state.deviceId},body:JSON.stringify(body||{}),redirect:'error',signal:AbortSignal.timeout(20000)});
  const reader=response.body.getReader();let length=0,parts=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>32768)throw Error('Respuesta del servidor demasiado grande.');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  let value;try{value=JSON.parse(Buffer.concat(parts).toString());}catch{throw Error('El servidor devolvió una respuesta inesperada.');}
  if(!response.ok)throw Error(typeof value.error==='string'?value.error.slice(0,300):'No se pudo comprobar la licencia.');return value;
 }
 async function refresh(){
  if(inFlight)return inFlight;
  inFlight=(async()=>{
   try{
    await init();lastAttempt=clock();
    const result=await request(state.lease?'/status':'/trial',state.lease?{}:{deviceId:state.deviceId,secret:state.secret});
    const next=decodeLease(result.lease,cfg,state.deviceId);
    // Reject replay of an older authorization; do not erase the last verified receipt on errors.
    if(claims&&next.iat<claims.iat)throw Error('El servidor devolvió una autorización anterior.');
    claims=next;state.lease=result.lease;state.lastSeen=Math.max(next.iat*1000,clock());anchor=state.lastSeen;anchorMono=monotonic();
    billingEnabled=result.billingEnabled===true;paymentCheckPending=result.paymentCheckPending===true;lastError='';await persist();
   }catch(e){lastError=e.message==='fetch failed'?'No pudimos conectar con el servidor de licencias. Revisa Internet e inténtalo de nuevo.':e.message;}
   finally{inFlight=null;publish();}
   return current();
  })();publish();return inFlight;
 }
 return {
  async status(){try{await init();}catch(e){lastError=e.message;}return current();},
  refresh,
  async authorizeWrite(){
   try{await init();}catch(e){lastError=e.message;return current();}
   let verdict=current();if(!verdict.canWrite&&clock()-lastAttempt>30000)verdict=await refresh();
   state.lastSeen=Math.max(state.lastSeen,Math.floor(verdict.now));
   // Persist each authorization before accepting a write; clock rollback cannot reset the trial.
   try{await persist();}catch(e){lastError='No se pudo guardar el estado de activación. Tus datos no se han cambiado.';return {...current(),canWrite:false,error:lastError};}
   publish();return current();
  },
  async checkout(){await init();await refresh();if(!billingEnabled)throw Error('La compra aún no está habilitada. Comprueba la licencia e inténtalo de nuevo.');const result=await request('/checkout',{requestId:require('node:crypto').randomUUID()});if(!checkoutAllowed(result.url)||result.mode!==cfg.mode)throw Error('El servidor devolvió una página de pago no válida.');return {url:result.url,mode:result.mode};},
  async tick(){try{await init();const now=current().now;if(clock()-lastPersist>60000){state.lastSeen=Math.max(state.lastSeen,Math.floor(now));await persist();lastPersist=clock();}}catch(e){lastError=e.message;}publish();},
  async flush(){if(state){state.lastSeen=Math.max(state.lastSeen,Math.floor(current().now));await persist();}},
 };
}
module.exports={createLicenseClient,validateConfig,decodeLease,checkoutAllowed,windowsDeviceId};
