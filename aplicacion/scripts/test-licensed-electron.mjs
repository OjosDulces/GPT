import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {generateKeyPairSync,sign} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {exerciseLocalWorkspace,assertLocalPersistence} from './local-workspace-scenario.mjs';
const root=process.cwd(),temp=await mkdtemp(path.join(os.tmpdir(),'ce-native-license-')),keys=generateKeyPairSync('ed25519'),DAY=86400000;
let status='trial',trialEnd=Date.now()+15*DAY,enrollments=0,secret,deviceId,offline=false;
const server=createServer(async(req,res)=>{
 if(offline){res.destroy();return;}
 let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body||'{}');
 if(req.url==='/trial'){enrollments++;deviceId=data.deviceId;secret=data.secret;}
 else assert.equal(req.headers.authorization,'Bearer '+secret);
 if(req.url==='/checkout'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:'https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=test-native',mode:'test'}));return;}
 const now=Date.now(),paidUntil=status==='active'?now+30*DAY:null;
 const claims={iss:'control-emprende-licenses',aud:'control-emprende-desktop',v:1,deviceId,licenseId:'test-one',mode:'test',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+7*86400,status,canWrite:status!=='read_only',trialEndsAt:trialEnd,paidUntil,writeUntil:paidUntil||trialEnd};
 const h=Buffer.from(JSON.stringify({alg:'EdDSA',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify(claims)).toString('base64url'),lease=h+'.'+p+'.'+sign(null,Buffer.from(h+'.'+p),keys.privateKey).toString('base64url');
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({lease,billingEnabled:true}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const config=path.join(temp,'config.json');await writeFile(config,JSON.stringify({server:`http://127.0.0.1:${server.address().port}`,mode:'test',publicKey:keys.publicKey.export({format:'jwk'})}));
const options={executablePath:path.join(root,'desktop/node_modules/electron/dist/electron'),args:['--disable-gpu','--password-store=basic',path.join(root,'desktop')],env:{...process.env,CE_TEST_DATA_DIR:temp,CE_TEST_LICENSE_CONFIG:config},timeout:30000};
let app;
try{
 app=await electron.launch(options);const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({session})=>{globalThis.ceDownloads=[];session.defaultSession.on('will-download',(_event,item)=>{const row={path:process.env.CE_TEST_DATA_DIR+'/'+Date.now()+'-'+item.getFilename(),state:'started'};globalThis.ceDownloads.push(row);item.setSavePath(row.path);item.once('done',(_e,state)=>row.state=state);});});
 const downloadFile=async button=>{const count=await app.evaluate(()=>globalThis.ceDownloads.length);await button.click();for(let i=0;i<150;i++){const last=await app.evaluate((_e,n)=>globalThis.ceDownloads[n],count);if(last?.state==='completed')return last.path;await new Promise(r=>setTimeout(r,100));}throw Error('Download timed out');};
 const expected=await exerciseLocalWorkspace(page,downloadFile);
 assert.equal(enrollments,1);assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 assert(await page.evaluate(async()=>{try{await fetch('https://example.com');return false;}catch{return true;}}));
 status='read_only';trialEnd=Date.now()-1000;await page.evaluate(()=>window.desktopLicense.refresh());await page.waitForFunction(()=>window.businessContext.role==='reader');
 const blocked=await page.evaluate(async()=>{try{await window.storage.setMany({sales:[]});return false;}catch(e){return e.code==='LICENSE';}});assert(blocked);
 assert.equal((await page.evaluate(()=>window.storage.getSnapshot())).sales.length,1);
 assert(await page.getByLabel('Importar respaldo',{exact:false}).isDisabled());
 const backup=await downloadFile(page.getByRole('button',{name:'Descargar respaldo',exact:true}));assert.equal(JSON.parse(await readFile(backup,'utf8')).data.sales.length,1);
 await page.getByRole('button',{name:'Mi licencia',exact:true}).click();await page.getByRole('heading',{name:'Solo lectura',exact:true}).waitFor();await page.screenshot({path:path.resolve('../pruebas/licencia-vencida.png'),fullPage:true});
 await app.evaluate(({shell})=>{globalThis.checkoutURLs=[];shell.openExternal=async url=>{globalThis.checkoutURLs.push(url);};});
 await page.getByRole('button',{name:'Probar compra · $9.990 CLP',exact:true}).click();await page.getByText('Se abrió Mercado Pago.',{exact:false}).waitFor();assert.deepEqual(await app.evaluate(()=>globalThis.checkoutURLs),['https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=test-native']);assert.equal((await page.evaluate(()=>window.desktopLicense.status())).canWrite,false);
 status='active';await page.evaluate(()=>window.desktopLicense.refresh());await page.waitForFunction(()=>window.businessContext.role==='owner');
 assert.equal((await page.evaluate(()=>window.desktopLicense.authorizeWrite())).canWrite,true);
 await page.getByRole('heading',{name:'Acceso activo',exact:true}).waitFor();await page.screenshot({path:path.resolve('../pruebas/licencia-activa.png'),fullPage:true});
 await app.close();app=null;offline=true;app=await electron.launch(options);const again=await app.firstWindow();await assertLocalPersistence(again,expected);await again.waitForFunction(()=>window.businessContext.role==='owner');assert.equal(enrollments,1);assert.deepEqual(errors,[]);
 console.log('PASS Electron Linux: datos propios, ventas/importación/restauración durante prueba; vencimiento bloquea escritura y restauración, conserva datos y respaldo; activación habilita edición; reinicio sin Internet conserva acceso firmado y datos; aislamiento del renderer.');
}catch(e){if(app){const p=await app.firstWindow();console.error('DIAGNOSTIC',await p.evaluate(async()=>({text:document.body.innerText.slice(0,4000),status:await window.desktopLicense?.status(),context:window.businessContext})));}throw e;}finally{if(app)await app.close();await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});}
