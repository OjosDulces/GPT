'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {spawn}=require('node:child_process');
const {getMakeNsisPath}=require('app-builder-lib/out/toolsets/windows');
const root=__dirname;
function run(cmd,args,env=process.env){return new Promise((resolve,reject)=>{const child=spawn(cmd,args,{cwd:root,env,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${path.basename(cmd)} terminó con código ${code}`)));});}
function q(s){return s.replaceAll('$','$$').replaceAll('"','$\\"');}
async function walk(dir,rel=''){const files=[],dirs=[];for(const e of await fs.readdir(path.join(dir,rel),{withFileTypes:true})){const p=path.join(rel,e.name);if(e.isDirectory()){dirs.push(p);const result=await walk(dir,p);files.push(...result.files);dirs.push(...result.dirs);}else if(e.isFile())files.push(p);else throw new Error('No se empaquetan enlaces simbólicos.');}return {files,dirs};}
(async()=>{
 require('./license-client.cjs').validateConfig(JSON.parse(await fs.readFile(path.join(root,'license-config.json'),'utf8')));
 await run(process.execPath,[require.resolve('electron-builder/cli.js'),'--win','dir','--x64','--publish','never']);
 const appDir=path.join(root,'release/win-unpacked');const {files,dirs}=await walk(appDir);
 const deletions=files.map(f=>'Delete "$INSTDIR\\'+q(f.split(path.sep).join('\\'))+'"').concat(dirs.sort((a,b)=>b.length-a.length).map(d=>'RMDir "$INSTDIR\\'+q(d.split(path.sep).join('\\'))+'"'));
 await fs.writeFile(path.join(root,'release/uninstall-files.nsh'),deletions.join('\n')+'\n');
 const tool=await getMakeNsisPath();
 const version=require('./package.json').version;
 await run(tool.path,['-V3','-INPUTCHARSET','UTF8',`-DAPP_DIR=${appDir}`,`-DRES_DIR=${path.join(root,'resources')}`,`-DRELEASE_DIR=${path.join(root,'release')}`,`-DVERSION=${version}`,path.join(root,'resources/installer.nsi')],{...process.env,...tool.env});
 const output=path.join(root,`release/Control-Emprende-${version}-Windows-x64-Instalador.exe`);
 const stat=await fs.stat(output);if(stat.size<10000000)throw new Error('El instalador no contiene el programa completo.');
 console.log(`Instalador completo: ${output} (${stat.size} bytes).`);
})().catch(e=>{console.error(e);process.exitCode=1;});
