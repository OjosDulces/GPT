import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {assetPath,CSP}=createRequire(import.meta.url)('../desktop/policy.cjs');
const web=path.resolve('desktop/web');
export const server=createServer(async(req,res)=>{const file=assetPath('ce-app://bundle'+req.url,web);try{if(!file)throw Error();res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream','Content-Security-Policy':CSP});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
