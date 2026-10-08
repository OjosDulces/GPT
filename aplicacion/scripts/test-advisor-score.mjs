import {installLicenseFixture} from './license-renderer-fixture.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {server} from './desktop-preview.mjs';
import {contrast} from '../src/domain/appearance.js';
const output=fileURLToPath(new URL('../../pruebas/',import.meta.url));
await mkdir(output,{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
const results=[],errors=[];
const hex=rgb=>'#'+rgb.match(/[\d.]+/g).slice(0,3).map(v=>Math.round(Number(v)).toString(16).padStart(2,'0')).join('');
try{
 for(const width of (process.env.SCORE_WIDTHS?process.env.SCORE_WIDTHS.split(',').map(Number):[1440,390,320]))for(const dark of [true,false]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await installLicenseFixture(page);await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('heading',{name:'Hagamos espacio para tu negocio'}).waitFor();
  await page.evaluate(async()=>{const s=await window.storage.getSnapshot();await window.storage.setMany({profile:{...s.profile,onboardingComplete:true}},{expectedVersion:s.version});});
  await page.reload();await page.locator('.command-center').waitFor();
  await page.getByRole('button',{name:'Personalizar mi espacio',exact:true}).click();
  await page.getByRole('button',{name:dark?'Oscuro':'Claro',exact:true}).click();
  await page.getByRole('button',{name:'Paleta Origen',exact:true}).click();
  await page.getByRole('button',{name:'Aplicar mi estilo',exact:true}).click();
  await page.getByRole('button',{name:'Conversar con mi asesor',exact:true}).click();
  for(const expected of [null,100,0]){
   await page.evaluate(async expected=>{
    const s=await window.storage.getSnapshot();
    const sales=expected===null?[]:Array.from({length:5},(_,i)=>{
     const dateISO=new Date(Date.now()-(20-i*3)*86400000).toISOString();
     return {id:`sale-${i}`,dateISO,total:100,cost:50,costKnown:true,paidAmount:100,payments:[{dateISO,amount:100}],items:[{productId:'qa-service',name:'Servicio de prueba',qty:1,price:100,unitCost:50}]};
    });
    const products=expected===0?Array.from({length:13},(_,i)=>({id:`empty-${i}`,name:`Producto ${i}`,stock:0,minStock:1,price:100,trackStock:true})):[];
    await window.storage.setMany({sales,products},{expectedVersion:s.version});
   },expected);
   await page.reload();await page.locator('.score-circle').waitFor();
   const circle=page.locator('.score-circle');
   assert.equal(await circle.locator('strong').innerText(),expected===null?'—':String(expected));
   assert.equal(await circle.locator('span').innerText(),expected===null?'Aprendiendo':'de 100');
   const metrics=await circle.evaluate(el=>{
    const box=el.getBoundingClientRect(),cs=getComputedStyle(el);
    return {background:cs.backgroundColor,texts:[...el.children].map(child=>{
     const s=getComputedStyle(child),range=document.createRange();range.selectNodeContents(child);const r=range.getBoundingClientRect();
     return {color:s.color,fontSize:parseFloat(s.fontSize),inside:r.left>=box.left+parseFloat(cs.borderLeftWidth)&&r.right<=box.right-parseFloat(cs.borderRightWidth)&&r.top>=box.top+parseFloat(cs.borderTopWidth)&&r.bottom<=box.bottom-parseFloat(cs.borderBottomWidth)};
    })};
   });
   const ratios=metrics.texts.map(t=>contrast(hex(t.color),hex(metrics.background)));
   if(width===1440&&dark&&expected===null&&process.env.CAPTURE_BEFORE)await page.locator('.advisor-header').screenshot({path:output+'indicador-antes.png'});
   for(const ratio of ratios)assert(ratio>=4.5,`Contraste insuficiente ${ratio.toFixed(2)}: width=${width} dark=${dark} score=${expected}`);
   assert(metrics.texts.every(t=>t.inside),'Texto fuera del círculo');
   assert(metrics.texts[1].fontSize>=11,'Etiqueta demasiado pequeña');
   const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,elements:[...document.querySelectorAll('.product-stack *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})).slice(0,12)}));assert(overflow.page<=overflow.viewport,'Desbordamiento horizontal '+JSON.stringify(overflow));
   if(width===1440||width===320)await page.locator('.advisor-header').screenshot({path:`${output}indicador-${width}-${dark?'oscuro':'claro'}-${expected??'aprendiendo'}.png`});
   results.push({width,dark,score:expected,contrast:ratios.map(n=>Number(n.toFixed(2))),contained:true});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(output+'indicador-resultados.json',JSON.stringify({results,errors},null,2));
 console.log(`PASS ${results.length} vistas: indicador vacío, 100 y 0; claro/oscuro; 320, 390 y 1440 px; contraste >=4.5:1 y texto dentro del círculo.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
