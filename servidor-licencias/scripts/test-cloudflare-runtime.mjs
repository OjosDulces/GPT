import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'ce-workerd-'));
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
let child,logs='';
try{
 await writeFile(path.join(dir,'entry.mjs'),'export {default} from "./worker.mjs";');
 await writeFile(path.join(dir,'worker.mjs'),await readFile(process.argv[2]||path.join(root,'worker-listo.js')));
 await writeFile(path.join(dir,'provider.mjs'),await readFile(path.join(root,'scripts/runtime-fixtures/mercadopago.mjs')));
 await writeFile(path.join(dir,'config.capnp'),`using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [
  (name = "main", worker = (modules = [(name = "main", esModule = embed "entry.mjs"), (name = "worker.mjs", esModule = embed "worker.mjs")], compatibilityDate = "2026-10-01", globalOutbound = "mp", bindings = [(name = "MP_ACCESS_TOKEN", text = "TEST-runtime-fixture"), (name = "MP_WEBHOOK_SECRET", text = "runtime-webhook-fixture"), (name = "PAYMENT_MODE", text = "test")])),
  (name = "mp", worker = (modules = [(name = "main", esModule = embed "provider.mjs")], compatibilityDate = "2026-10-01"))
 ],
 sockets = [(name = "http", address = "127.0.0.1:${port}", http = (), service = "main")]
);`);
 child=spawn(createRequire(import.meta.url).resolve('workerd/bin/workerd'),['serve',path.join(dir,'config.capnp')],{stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs=(logs+b).slice(-8000));child.stderr.on('data',b=>logs=(logs+b).slice(-8000));let startupError;child.on('error',e=>startupError=e);
 const base=`http://127.0.0.1:${port}`;let ready=false;
 for(let i=0;i<60;i++){if(startupError)throw startupError;if(child.exitCode!==null)throw Error('workerd exited: '+logs);try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert(ready,'workerd startup: '+logs);
 async function webhook(id){const ts=String(Math.floor(Date.now()/1000)),rid='runtime-request',sig=createHmac('sha256','runtime-webhook-fixture').update(`id:${id};request-id:${rid};ts:${ts};`).digest('hex');return fetch(base+'/webhooks/mercadopago?data.id='+id,{method:'POST',headers:{'x-request-id':rid,'x-signature':`ts=${ts},v1=${sig}`},body:'{}'});}
 const success=await webhook(123),body=await success.json();assert.equal(success.status,200,JSON.stringify(body));assert.equal(body.result,'ignored');console.log('PASS real workerd: authenticated outbound fetch succeeds with production Worker code.');
 const redirect=await webhook(456);assert.equal(redirect.status,502);assert.match((await redirect.json()).error,/HTTP 302/);console.log('PASS real workerd: provider redirect is rejected, not followed.');
 const rejected=await webhook(789);assert.equal(rejected.status,502);const error=(await rejected.json()).error;assert.match(error,/HTTP 401/);assert(!error.includes('TEST-runtime-fixture'));console.log('PASS real workerd: HTTP rejection remains distinct from connection failures; credential is not exposed.');
}finally{if(child&&child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await stopped;}await rm(dir,{recursive:true,force:true});}
