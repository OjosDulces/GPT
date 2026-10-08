import { readFile, writeFile } from 'node:fs/promises';
const css=await readFile('demo-build/demo.css','utf8');
let js=await readFile('demo-build/demo.js','utf8');
const svg=await readFile('public/favicon.svg','utf8');
const icon=`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
js=js.replaceAll('/favicon.svg',icon).replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Control Emprende · Demostración</title><link rel="icon" href="${icon}"><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await writeFile('ABRIR_DEMO.html',html);
console.log('Demo autónoma preparada: ABRIR_DEMO.html');
