import {createServer,preview} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const production=process.env.QA_PREVIEW==='1';
const server=production?await preview({preview:{host:'127.0.0.1',port:0},logLevel:'silent'}):await createServer({server:{host:'127.0.0.1',port:0},logLevel:'silent'});if(!production)await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')});
const url=`http://127.0.0.1:${server.httpServer.address().port}/?demo=1`,errors=[],report={build:production?'production':'development',viewports:[],motion:{},limitations:'Medición local en Chromium. No garantiza una tasa de cuadros en todos los PC.'};
try{
 await mkdir('docs/capturas',{recursive:true});
 for(const width of JSON.parse(process.env.QA_WIDTHS||'[1440,1280,390,320]')){
  const page=await browser.newPage({viewport:{width,height:width<500?844:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await page.getByRole('heading',{name:'Tu negocio, a tu manera.'}).waitFor();
  const font=await page.evaluate(()=>{const size=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);return {label:size('.command-metric>div'),helper:size('.command-metric>p'),description:size('.od-page-description'),amount:size('.command-metric>strong'),overflow:document.documentElement.scrollWidth>innerWidth};});
  assert(font.label>=13);assert(font.helper>=12);assert(font.description>=14);assert(!font.overflow,`Desborde ${width}`);
  if(width===1440||width===390)await page.screenshot({animations:'disabled',path:`docs/capturas/lectura-${width}.png`,fullPage:true});
  const before=await page.locator('.workspace-business').boundingBox();
  await page.getByRole('button',{name:'Personalizar mi espacio',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Hazlo tuyo'});await dialog.waitFor();const after=await page.locator('.workspace-business').boundingBox();assert(Math.abs(before.x-after.x)<1,'El modal desplaza la cabecera');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1440||width===390)await page.screenshot({animations:'disabled',path:`docs/capturas/editor-legible-${width}.png`});
  const motion=await dialog.evaluate(el=>({name:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration,blur:getComputedStyle(el.parentElement).backdropFilter}));assert.equal(motion.blur,'none');
  await page.getByLabel('Tamaño del texto',{exact:true}).selectOption('large');await page.getByRole('button',{name:'Oscuro',exact:true}).click();await page.getByRole('button',{name:'Aplicar mi estilo',exact:true}).click();assert(await page.locator('.ce-v4.od-dark').count());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const large=await page.locator('.command-metric>div').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert(large>=16);if(width===1440)await page.screenshot({animations:'disabled',path:'docs/capturas/lectura-grande-oscuro.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Personalizar mi espacio',exact:true}).click();assert.equal(await dialog.evaluate(el=>getComputedStyle(el).animationName),'none');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  report.viewports.push({width,...font,largeFont:large,dialogShiftX:after.x-before.x,motion});await page.close();
 }
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(url);await page.getByRole('heading',{name:'Tu negocio, a tu manera.'}).waitFor();
 await page.evaluate(()=>{window.ceFrames=[];window.ceLongTasks=[];window.ceSampling=true;let last=performance.now();function tick(now){window.ceFrames.push(now-last);last=now;if(window.ceSampling)requestAnimationFrame(tick);}requestAnimationFrame(tick);new PerformanceObserver(list=>window.ceLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:false});});
 for(let i=0;i<4;i++){await page.getByRole('button',{name:'Personalizar mi espacio',exact:true}).click();await page.getByRole('tab',{name:'Identidad'}).click();await page.getByRole('tab',{name:'Mi inicio',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();}
 const nav=page.getByRole('navigation',{name:'Navegación principal'});for(const name of ['Clientes','Informes','Inicio']){await nav.getByRole('button',{name,exact:true}).click();}
 report.motion=await page.evaluate(()=>{window.ceSampling=false;const sorted=window.ceFrames.slice(1).sort((a,b)=>a-b);return {samples:sorted.length,medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],framesOver50ms:sorted.filter(x=>x>50).length,longTasksOver50ms:window.ceLongTasks.length,longestTaskMs:Math.max(0,...window.ceLongTasks)};});
 assert.equal(await page.locator('.workspace-page-content').count(),1);assert.deepEqual(errors,[]);await writeFile('docs/LECTURA_Y_MOVIMIENTO_QA.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log('PASS tipografía, escritorio/móvil, sin desplazamiento horizontal al abrir modal, texto grande, modo oscuro y movimiento reducido.');
}finally{await browser.close();if(production)await new Promise(resolve=>server.httpServer.close(resolve));else await server.close();}
