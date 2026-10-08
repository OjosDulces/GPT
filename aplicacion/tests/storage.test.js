import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudStorage } from '../src/lib/cloudStorage.js';
const fixture=(rpcResult={data:{version:1,products:[]}})=>{
 const calls=[],cache=new Map();
 const client={from(){return{select(){return this;},eq(){return this;},async single(){return{data:{version:0,products:[]}};}};},async rpc(name,args){calls.push({name,args});return rpcResult;}};
 const storage=createCloudStorage({supabase:client,businessId:'b',userId:'u',cache:{setItem:(k,v)=>cache.set(k,v),getItem:k=>cache.get(k),removeItem:k=>cache.delete(k)}});
 return {storage,calls,cache,client};
};
test('Un guardado compuesto usa una sola RPC y la versión esperada',async()=>{
 const {storage,calls}=fixture();await storage.getSnapshot();await storage.setMany({products:[],sales:[]},{expectedVersion:0,action:'sale.create'});
 assert.equal(calls.length,1);assert.deepEqual(Object.keys(calls[0].args.p_patch),['products','sales']);assert.equal(calls[0].args.p_expected_version,0);
});
test('Un conflicto no se reintenta ni se confirma como éxito',async()=>{
 const {storage,calls,cache}=fixture({error:{code:'40001',message:'Conflict'}});await storage.getSnapshot();await assert.rejects(storage.setMany({products:[]}),e=>e.code==='CONFLICT');assert.equal(calls.length,1);assert.equal(JSON.parse([...cache.values()][0]).version,0);
});
test('Sin red y acceso lector bloquean las escrituras antes de llamar a la red',async()=>{
 const {client,calls}=fixture();for(const config of [{online:()=>false},{role:'reader'}]){const storage=createCloudStorage({supabase:client,businessId:'b',userId:'u',...config});await assert.rejects(storage.setMany({products:[]},{expectedVersion:0}));}assert.equal(calls.length,0);
});
test('Una denegación de permisos nunca muestra el respaldo local',async()=>{
 const {storage,client}=fixture();await storage.getSnapshot();client.from=()=>({select(){return this},eq(){return this},async single(){return{error:{code:'42501',message:'Denied'}}}});
 await assert.rejects(storage.getSnapshot(true),/Denied/);
});
test('Un resultado incierto exige releer antes de otra escritura',async()=>{
 const {storage,calls}=fixture({error:{message:'Failed to fetch'}});await storage.getSnapshot();await assert.rejects(storage.setMany({products:[]}),e=>e.code==='UNCERTAIN');await assert.rejects(storage.setMany({products:[]}),e=>e.code==='UNCERTAIN');assert.equal(calls.length,1);
});
