import {readFile,writeFile} from 'node:fs/promises';
const css=await readFile('landing-build/landing.css','utf8');
const js=(await readFile('landing-build/landing.js','utf8')).replace(/<\/script/gi,'<\\/script');
await writeFile('PAGINA_COMERCIAL.html',`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Control Emprende · Página comercial</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
console.log('Página comercial autónoma preparada.');
