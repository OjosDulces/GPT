import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{assetPath,CSP}=require('../desktop/policy.cjs');
const web=path.resolve('desktop/web'),temp=await mkdtemp(path.join(os.tmpdir(),'ce-renderer-'));
const server=createServer(async(req,res)=>{const file=assetPath('ce-app://bundle'+req.url,web);try{if(!file)throw Error();const body=await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream','Content-Security-Policy':CSP});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const options={headless:true,viewport:{width:1440,height:1000},...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')};
let browser;
try{
 browser=await chromium.launchPersistentContext(temp,options);const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());const url=`http://127.0.0.1:${server.address().port}/`;
 await page.goto(url);await page.getByRole('heading',{name:'Tu negocio, a tu manera.'}).waitFor();assert.match(await page.locator('.ce-demo-bar').innerText(),/datos ficticios en este equipo/);
 await mkdir('docs/capturas',{recursive:true});await page.screenshot({path:'docs/capturas/vista-edicion-escritorio.png'});
 const before=await page.evaluate(()=>window.storage.getSnapshot());await page.getByRole('button',{name:'Nueva venta',exact:true}).first().click();await page.getByRole('button',{name:/Caja de alfajores/}).click();await page.getByRole('button',{name:'Registrar venta',exact:true}).click();await page.getByText('Venta lista ·',{exact:false}).waitFor();const after=await page.evaluate(()=>window.storage.getSnapshot());assert.equal(after.sales.length,before.sales.length+1);
 await page.getByRole('button',{name:'Personalizar mi espacio',exact:true}).click();await page.getByRole('button',{name:'Paleta Órbita'}).click();await page.getByRole('button',{name:'Aplicar mi estilo',exact:true}).click();const nav=page.getByRole('navigation',{name:'Navegación principal'});await nav.getByRole('button',{name:'Informes',exact:true}).click();const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar informe',exact:true}).click();const download=await promise;const downloaded=await download.path();assert((await readFile(downloaded,'utf8')).length>30);
 const blocked=await page.evaluate(async()=>{try{await fetch('https://example.com');return false;}catch{return true;}});assert(blocked);assert.deepEqual(errors,[]);
 await browser.close();browser=await chromium.launchPersistentContext(temp,options);const again=await browser.newPage();await again.goto(url);await again.locator('.ce-v4').waitFor();assert.equal((await again.evaluate(()=>window.storage.getSnapshot())).sales.length,after.sales.length);assert.equal(await again.locator('.ce-v4').evaluate(el=>el.style.getPropertyValue('--ce-accent')),'#8b5cf6');
 console.log('PASS interfaz compilada de escritorio: inicio, venta, CSV, política de red y persistencia después de cerrar y abrir el navegador de pruebas.');
 console.log('Esta prueba valida el renderer en Chromium, no la instalación nativa de Windows.');
}finally{if(browser)await browser.close();server.close();await rm(temp,{recursive:true,force:true});}
