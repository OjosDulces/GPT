import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Base de datos: aislamiento, roles, migración, atomicidad, concurrencia e invitaciones', async t=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 const base=(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8')).split('-- Activa cambios en tiempo real')[0].replace('create extension if not exists pgcrypto;','');
 await db.exec(base);
 const migration=await readFile(new URL('../supabase/migrations/003_commercial_foundation.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
 const owner='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users values ($1,$2),($3,$4)',[owner,'owner@example.test',other,'other@example.test']);
 const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
 const rpc=async(sql,params=[])=>(await db.query(sql,params)).rows;
 await as(owner);const a=(await rpc("select * from public.create_business('Negocio A')"))[0], b=(await rpc("select * from public.create_business('Negocio B')"))[0];
 const commit=async(id,version,patch,op=crypto.randomUUID())=> (await rpc('select public.commit_business_data($1,$2,$3,$4,$5) as result',[id,version,JSON.stringify(patch),op,'test']))[0].result;
 await t.test('Una cuenta puede crear dos negocios',()=>assert.notEqual(a.business_id,b.business_id));
 await t.test('Actualizar directamente el contenedor está prohibido',async()=>{await assert.rejects(rpc('update public.business_data set products=$1 where business_id=$2',['[]',a.business_id]),e=>e.code==='42501');});
 await t.test('Operación compuesta e idempotencia',async()=>{
  const op=crypto.randomUUID(),patch={products:[{id:'p',name:'Pan',stock:8}],movements:[{id:'m',qty:8}]};
  const first=await commit(a.business_id,0,patch,op);assert.equal(first.version,1);const again=await commit(a.business_id,0,patch,op);assert.equal(again.version,1);
  await assert.rejects(commit(a.business_id,0,{products:[]}),e=>e.code==='40001');
  await assert.rejects(commit(a.business_id,1,{products:[]},op),e=>e.code==='22023');
 });
 await t.test('Una colección inválida cancela toda la operación',async()=>{
  await assert.rejects(commit(a.business_id,1,{products:[{id:'p',stock:2}],sales:[{id:'x',items:[]}]}));const row=(await rpc('select version,products from public.business_data where business_id=$1',[a.business_id]))[0];assert.equal(row.version,1);assert.equal(row.products[0].stock,8);
 });
 await t.test('Registro de auditoría y perfil protegido',async()=>{
  assert.equal((await rpc('select * from public.business_audit where business_id=$1',[a.business_id])).length,1);
  await assert.rejects(commit(a.business_id,1,{profile:{name:'A',currency:'JPY'}}));
 });
 await as(other);
 await t.test('Un tercero no lee ni escribe otro negocio',async()=>{
  assert.equal((await rpc('select * from public.business_data')).length,0);await assert.rejects(commit(a.business_id,1,{products:[]}),e=>e.code==='42501');
 });
 await t.test('Invitación válida da acceso al negocio correcto',async()=>{
  await rpc('select public.join_business_by_code($1)',[a.join_code]);assert.equal((await rpc('select * from public.business_data')).length,1);
  await assert.rejects(rpc('select join_code from public.businesses'),e=>e.code==='42501');await assert.rejects(rpc('select * from public.get_business_invite($1)',[a.business_id]),e=>e.code==='42501');
  await assert.rejects(commit(b.business_id,0,{products:[]}),e=>e.code==='42501');
 });
 await as(owner);await rpc('select public.set_business_member_role($1,$2,$3)',[a.business_id,other,'reader']);await as(other);
 await t.test('Un lector consulta, pero no puede escribir ni elevar su rol',async()=>{
  assert.equal((await rpc('select * from public.business_data')).length,1);await assert.rejects(commit(a.business_id,1,{products:[]}),e=>e.code==='42501');await assert.rejects(rpc('select public.set_business_member_role($1,$2,$3)',[a.business_id,other,'owner']),e=>e.code==='42501');
 });
 await as(owner);
 await t.test('La propiedad se conserva y se puede retirar a un integrante',async()=>{
  await assert.rejects(rpc('select public.set_business_member_role($1,$2,$3)',[a.business_id,owner,'remove']));await rpc('select public.set_business_member_role($1,$2,$3)',[a.business_id,other,'remove']);
  await rpc('select public.rotate_business_code($1)',[a.business_id]);await as(other);await assert.rejects(rpc('select public.join_business_by_code($1)',[a.join_code]));assert.equal((await rpc('select * from public.business_data')).length,0);
 });
 await db.close();
});
