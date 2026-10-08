import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {internalURL,externalURL,assetPath}=require('../desktop/policy.cjs');
test('Escritorio: el protocolo solo sirve archivos del paquete',()=>{
 const root=path.resolve('/app/web');
 assert.equal(assetPath('ce-app://bundle/',root),path.join(root,'desktop.html'));
 assert.equal(assetPath('ce-app://bundle/assets/main.js',root),path.join(root,'assets/main.js'));
 for(const url of ['file:///etc/passwd','ce-app://other/assets/main.js','ce-app://bundle/%2e%2e%2fsecret','ce-app://bundle/%5csecret','ce-app://bundle/%00file','ce-app://user@bundle/index.html','ce-app://bundle:99/'])assert.equal(assetPath(url,root),null,url);
});
test('Escritorio: navegación y enlaces externos excluyen protocolos ejecutables',()=>{
 assert(internalURL('ce-app://bundle/?demo=1'));
 assert(externalURL('https://wa.me/56912345678'));
 for(const url of ['javascript:alert(1)','file:///C:/secret','data:text/html,hello','http://site.test','https://user:password@site.test','ce-app://bundle/'])assert(!externalURL(url),url);
});
