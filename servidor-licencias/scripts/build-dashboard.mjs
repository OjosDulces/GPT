import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const policy=await readFile(new URL('src/policy.mjs',root),'utf8');
const worker=await readFile(new URL('src/worker.mjs',root),'utf8');
const bundled='// Generado con node scripts/build-dashboard.mjs. Sin credenciales incluidas.\n'+policy+'\n'+worker.replace(/^import .*from '\.\/policy.mjs';\n/,'');
await writeFile(new URL('worker-listo.js',root),bundled);
console.log('worker-listo.js preparado para el editor de Cloudflare.');
