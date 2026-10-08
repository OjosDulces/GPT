import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {catalogSlug,catalogImage,previewCatalog,defaultCatalog,whatsappLink,validateCatalog} from '../src/domain/catalog.js';

test('Catálogo: enlaces seguros y proyección de vista previa',()=>{
 assert.equal(catalogSlug('Panadería Sol & Mar'),'panaderia-sol-mar');
 assert.equal(catalogImage('javascript:alert(1)'),'');assert.equal(catalogImage('data:image/svg+xml;base64,AAAA'),'');
 const settings={...defaultCatalog({name:'Tienda'}),productIds:['a','b'],showPrices:false};
 const r=previewCatalog(settings,[{id:'a',name:'A',price:20,stock:99,costPerUnit:10,publicDescription:'Solo público'},{id:'b',active:false}]);
 assert.deepEqual(Object.keys(r.products[0]).sort(),['category','description','id','image','name','price']);assert.equal(r.products.length,1);assert.equal(r.products[0].price,null);
 assert.equal(whatsappLink('invalid','A'),'');assert.match(whatsappLink('56912345678','A','B'),/^https:\/\/wa.me\/56912345678\?text=/);
 assert.throws(()=>validateCatalog({...settings,slug:'xx'},[]),/dirección/);
});

test('Catálogo: permisos, publicación y aislamiento en PostgreSQL',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const base=(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8')).split('-- Activa cambios en tiempo real')[0].replace('create extension if not exists pgcrypto;','');await db.exec(base);
 for(const name of ['003_commercial_foundation','004_integrated_product','005_reporting','006_public_catalogs'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/006_public_catalogs.sql',import.meta.url),'utf8'));
 const owner=crypto.randomUUID(),other=crypto.randomUUID(),member=crypto.randomUUID(),reader=crypto.randomUUID();
 for(const uid of [owner,other,member,reader])await db.query('insert into auth.users values($1,$2)',[uid,`${uid}@example.test`]);
 const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);await db.exec(uid?'set role authenticated':'set role anon');};
 const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 await as(owner);const bid=(await q("select * from public.create_business('Tienda Sol')"))[0].business_id;
 await as(other);const bid2=(await q("select * from public.create_business('Otro negocio')"))[0].business_id;
 await db.exec('reset role');for(const [uid,role]of [[member,'member'],[reader,'reader']])await q('insert into public.business_members(business_id,user_id,role)values($1,$2,$3)',[bid,uid,role]);
 await as(owner);
 const products=[{id:'p1',name:'Tazón',category:'Cerámica',price:5900,image:'data:image/png;base64,AAAA',publicDescription:'Hecho a mano',stock:99,recipe:[{cost:123}],costPerUnit:1000,internalNote:'PRIVADO'},{id:'p2',name:'Secreto',price:8000},{id:'p3',name:'Archivado',price:1000,active:false}];
 const commit=async(v,patch)=>q('select public.commit_business_data($1,$2,$3,$4,$5)',[bid,v,JSON.stringify(patch),crypto.randomUUID(),'test']);
 await commit(0,{products,profile:{name:'Tienda Sol',currency:'CLP',countryCode:'56',inventoryMode:'manual',timezone:'America/Santiago',privateContact:'NO PUBLICAR'},customers:[{id:'c1',name:'Privado'}]});
 const settings={...defaultCatalog({name:'Tienda Sol'}),productIds:['p1'],whatsapp:'56912345678'};
 const save=(v,s=settings,published=false,id=bid)=>q('select public.save_business_catalog($1,$2,$3,$4) result',[id,v,JSON.stringify(s),published]).then(r=>r[0].result);
 const read=async(slug='tienda-sol')=>(await q('select public.get_public_business_catalog($1) result',[slug]))[0].result;
 await t.test('Un borrador no aparece; anónimos no leen tablas ni configuración privada',async()=>{
  const r=await save(0,{...settings,privateSecret:'NO'});assert.equal(r.version,1);assert.equal(r.settings.privateSecret,undefined);
  await as(null);assert.equal(await read(),null);
  for(const table of ['business_catalogs','business_data'])await assert.rejects(q(`select * from public.${table}`),e=>e.code==='42501');
  await assert.rejects(q('select public.get_business_catalog_settings($1)',[bid]),e=>e.code==='42501');await assert.rejects(save(1),e=>e.code==='42501');await as(owner);
 });
 await t.test('Solo propietario: otro negocio, colaboradores y lectores no publican',async()=>{
  for(const uid of [other,member,reader]){await as(uid);await assert.rejects(save(1),e=>e.code==='42501');await assert.rejects(q('select public.get_business_catalog_settings($1)',[bid]),e=>e.code==='42501');}await as(owner);
 });
 await t.test('Valida enlaces, selección, formatos y publicación vacía',async()=>{
  for(const patch of [{slug:'../x'},{productIds:[]},{productIds:['p1','p1']},{productIds:['p3']},{productIds:['otro-negocio']},{whatsapp:'javascript:1'},{theme:'invalid'},{showPrices:'false'}])await assert.rejects(save(1,{...settings,...patch},true),e=>e.code==='22023');
  await assert.rejects(save(1,{...settings,productIds:undefined},false),e=>e.code==='22023');
 });
 await t.test('Publicación anónima expone solo campos aprobados; precio oculto se omite del dato',async()=>{
  await save(1,settings,true);await as(null);const r=await read();assert.equal(r.products.length,1);assert.equal(r.currency,'CLP');assert.equal(r.products[0].price,5900);
  assert.deepEqual(Object.keys(r).sort(),['currency','products','settings','slug']);assert.deepEqual(Object.keys(r.products[0]).sort(),['category','description','id','image','name','price']);assert(!JSON.stringify(r).includes('PRIVADO'));assert(!JSON.stringify(r).includes('NO PUBLICAR'));
  await as(owner);await save(2,{...settings,showPrices:false},true);await as(null);assert.equal((await read()).products[0].price,null);await as(owner);
 });
 await t.test('Cambios simultáneos no se sobrescriben; direcciones únicas entre negocios',async()=>{
  await assert.rejects(save(2,settings,true),e=>e.code==='40001');await as(other);await assert.rejects(save(0,{...settings,productIds:[]},false,bid2),e=>e.code==='23505');await as(owner);
 });
 await t.test('Nuevos productos quedan fuera; precios y archivo se reflejan sin republicar',async()=>{
  await save(3,settings,true);await commit(1,{products:[{...products[0],price:6500,image:'javascript:alert(1)'},...products.slice(1),{id:'p4',name:'Nuevo',price:2000}]});
  await as(null);let r=await read();assert.equal(r.products.length,1);assert.equal(r.products[0].price,6500);assert.equal(r.products[0].image,'');await as(owner);
  await commit(2,{products:products.map(p=>({...p,active:false}))});await as(null);assert.equal((await read()).products.length,0);await as(owner);
 });
 await t.test('Retirar una página revoca lectura; enlace inexistente no filtra existencia del negocio',async()=>{
  await save(4,{...settings,productIds:[]},false);await as(null);assert.equal(await read(),null);assert.equal(await read('no-existe'),null);await as(owner);
  await assert.rejects(q("update public.business_catalogs set published=true where business_id=$1",[bid]),e=>e.code==='42501');
 });
});
