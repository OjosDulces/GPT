import {installLicenseFixture} from './license-renderer-fixture.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {server} from './desktop-preview.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('../../pruebas/',import.meta.url));await mkdir(output,{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
const base=`http://127.0.0.1:${server.address().port}/`,results=[],errors=[];
try{
 for(const width of [1440,1280,1024,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:'light'});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await installLicenseFixture(page);await page.goto(base);await page.getByRole('heading',{name:'Hagamos espacio para tu negocio'}).waitFor();
  await page.evaluate(async()=>{const data=await window.storage.getSnapshot();await window.storage.setMany({profile:{...data.profile,name:'Mi negocio',onboardingComplete:true}},{expectedVersion:data.version});});await page.reload();await page.locator('.command-center').waitFor();
  for(const dark of [false,true]){
   if(dark){await page.getByRole('button',{name:'Personalizar mi espacio',exact:true}).click();await page.getByRole('button',{name:'Oscuro',exact:true}).click();await page.getByRole('button',{name:'Aplicar mi estilo',exact:true}).click();}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width} dark=${dark}`);
   assert.equal(await page.locator('.home-section').count(),3);
   for(const name of ['Tus números, sin vueltas.','¿Qué necesitas hacer?','Tu día a día, por partes.'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),1);
   const metrics=await page.evaluate(()=>{
    const sections=[...document.querySelectorAll('.home-section')].map(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,border:getComputedStyle(el).borderTopWidth,background:getComputedStyle(el).backgroundColor}));
    const card=document.querySelector('.command-metric');return {sections,cardBackground:getComputedStyle(card).backgroundColor,pageBackground:getComputedStyle(document.querySelector('.ce-v4')).backgroundColor};
   });
   assert(metrics.sections[1].top-metrics.sections[0].bottom>=20);assert(metrics.sections[2].top-metrics.sections[1].bottom>=20);assert.notEqual(metrics.cardBackground,metrics.pageBackground);
   if(width===1440){assert.equal(await page.locator('.workspace-navigation>div').count(),4);await page.screenshot({path:`${output}inicio-${dark?'oscuro':'claro'}.png`,fullPage:true});}
   if(width===390&&!dark)await page.screenshot({path:output+'inicio-movil-claro.png',fullPage:true});
   results.push({width,dark,gap1:metrics.sections[1].top-metrics.sections[0].bottom,gap2:metrics.sections[2].top-metrics.sections[1].bottom,overflow:false});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(output+'secciones-resultados.json',JSON.stringify({results,errors},null,2));console.log('PASS 10 vistas: secciones separadas, fondos distintos, menú agrupado, temas claro/oscuro y sin desbordamiento desde 320 a 1440 px.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
