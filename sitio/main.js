const menu=document.querySelector('.menu-toggle');
const nav=document.querySelector('#main-nav');
function closeMenu(){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Abrir menú');nav.classList.remove('is-open');}
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');nav.classList.toggle('is-open',open);});
nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('is-open')){closeMenu();menu.focus();}});
const views={inicio:{image:'/assets/inicio.png',caption:'Inicio de Control Emprende sin registros precargados',description:'Consulta ventas, cobros pendientes y próximos pasos. Las capturas ilustran las funciones; tu negocio empieza vacío.'},personalizacion:{image:'/assets/personalizacion.png',caption:'Espacio personalizado en modo oscuro de Control Emprende',description:'Elige tu paleta, incorpora un logo y reordena las tarjetas y accesos. Tus preferencias se conservan en la aplicación de este equipo.'},catalogo:{image:'/assets/catalogo.png',caption:'Ejemplo de la página de productos de un negocio',description:'Elige productos y prepara tu presentación. La prueba incluye la vista previa; publicar un enlace real requiere activar la versión conectada.'}};
const tabs=[...document.querySelectorAll('[role=tab]')];
const panel=document.getElementById('gallery-panel');
function selectView(tab){const view=views[tab.dataset.view];tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1;});panel.setAttribute('aria-labelledby',tab.id);const image=panel.querySelector('img'),opener=panel.querySelector('button');image.src=view.image;image.alt=view.caption;opener.dataset.image=view.image;opener.dataset.caption=view.caption;document.getElementById('gallery-description').textContent=view.description;}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>selectView(tab));tab.addEventListener('keydown',e=>{let next;if(['ArrowDown','ArrowRight'].includes(e.key))next=(index+1)%tabs.length;if(['ArrowUp','ArrowLeft'].includes(e.key))next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();tabs[next].focus();selectView(tabs[next]);}});});
const dialog=document.querySelector('.image-dialog');let previousFocus;
document.querySelectorAll('.screenshot-open').forEach(button=>button.addEventListener('click',()=>{previousFocus=button;document.getElementById('full-image').src=button.dataset.image;document.getElementById('full-image').alt=button.dataset.caption;document.getElementById('image-caption').textContent=button.dataset.caption;dialog.showModal();document.documentElement.classList.add('modal-open');}));
document.getElementById('close-image').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.documentElement.classList.remove('modal-open');previousFocus?.focus({preventScroll:true});});

// Cloudflare Pages serves the installer in immutable parts below its per-file limit.
// The visitor receives one verified Windows installer, not the parts or a web app.
const downloadButton=document.getElementById('download-installer');
const downloadLabel=document.getElementById('download-label');
const status=document.getElementById('download-status');
const progress=document.getElementById('download-progress');
const meter=document.getElementById('download-meter');
const progressLabel=document.getElementById('progress-label');
let manifest=null,controller=null,lastPercent=-1;
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async buffer=>hex(await crypto.subtle.digest('SHA-256',buffer));
function message(text,error=false){status.textContent=text;status.classList.toggle('is-error',error);}
function validateManifest(value){
 if(!value||!/^\d+\.\d+\.\d+$/.test(value.version)||!/^Control-Emprende-[\w.-]+\.exe$/.test(value.file)||!Number.isSafeInteger(value.size_bytes)||value.size_bytes<=0||value.size_bytes>500*1024*1024||!/^[a-f0-9]{64}$/.test(value.sha256)||!Array.isArray(value.parts)||!value.parts.length||value.parts.length>32)throw Error('Manifest invalid');
 let total=0;const names=new Set();
 for(const part of value.parts){
  if(!/^\/descargas\/[a-zA-Z0-9._-]+\.bin$/.test(part.url)||!Number.isSafeInteger(part.size_bytes)||part.size_bytes<=0||part.size_bytes>24*1024*1024||!/^[a-f0-9]{64}$/.test(part.sha256)||names.has(part.url))throw Error('Part invalid');
  names.add(part.url);total+=part.size_bytes;
 }
 if(total!==value.size_bytes)throw Error('Size mismatch');
 return value;
}
async function loadVersion(){
 downloadButton.disabled=true;downloadLabel.textContent='Preparando descarga…';
 try{
  const response=await fetch('/descargas/version.json',{cache:'no-store'});
  if(!response.ok)throw Error('Version unavailable');
  manifest=validateManifest(await response.json());
  document.querySelectorAll('[data-version]').forEach(el=>el.textContent=manifest.version);
  document.getElementById('file-size').textContent=(manifest.size_bytes/(1024*1024)).toLocaleString('es-CL',{maximumFractionDigits:1})+' MB';
  if(!crypto.subtle)throw Error('Secure context required');
  downloadLabel.textContent='Descargar instalador para Windows';downloadButton.disabled=false;
 }catch{
  manifest=null;downloadLabel.textContent='Reintentar descarga';downloadButton.disabled=false;
  message('No pudimos preparar la descarga. Comprueba tu conexión e inténtalo de nuevo.',true);
 }
}
function updateProgress(received,total){
 const percent=Math.min(100,Math.floor(received/total*100));
 if(percent!==lastPercent){lastPercent=percent;meter.value=percent;meter.textContent=percent+'%';progressLabel.textContent=`Descargando instalador · ${percent}%`;}
}
async function readPart(part,received,signal){
 const response=await fetch(part.url,{signal,cache:'default'});
 if(!response.ok)throw Error('Part unavailable');
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{
  while(true){
   const {value,done}=await reader.read();if(done)break;
   length+=value.length;if(length>part.size_bytes)throw Error('Part too large');
   chunks.push(value);updateProgress(received+length,manifest.size_bytes);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 if(length!==part.size_bytes)throw Error('Incomplete download');
 const bytes=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(await digest(bytes)!==part.sha256)throw Error('Checksum mismatch');
 return bytes;
}
async function downloadInstaller(){
 if(controller)return;
 if(!manifest){message('');await loadVersion();return;}
 controller=new AbortController();const signal=controller.signal;
 downloadButton.disabled=true;downloadLabel.textContent='Descargando…';progress.hidden=false;lastPercent=-1;updateProgress(0,manifest.size_bytes);
 message('Mantén esta página abierta mientras se descarga el instalador.');
 try{
  const parts=[];let received=0;
  for(const part of manifest.parts){
   signal.throwIfAborted();const bytes=await readPart(part,received,signal);parts.push(bytes);received+=bytes.length;
  }
  signal.throwIfAborted();progressLabel.textContent='Verificando el instalador…';
  const file=new Blob(parts,{type:'application/vnd.microsoft.portable-executable'});
  if(await digest(await file.arrayBuffer())!==manifest.sha256)throw Error('Installer checksum mismatch');
  signal.throwIfAborted();
  const url=URL.createObjectURL(file),link=document.createElement('a');
  link.href=url;link.download=manifest.file;link.hidden=true;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),120000);
  message('Instalador preparado. Revisa las descargas de tu navegador y abre el archivo .exe para instalar Control Emprende.');
  downloadLabel.textContent='Descargar de nuevo';
 }catch(error){
  if(signal.aborted){message('Descarga cancelada. Puedes volver a iniciarla cuando quieras.');downloadLabel.textContent='Descargar instalador para Windows';}
  else{message('No se completó la descarga. No se entregó un archivo incompleto. Comprueba tu conexión y vuelve a intentarlo.',true);downloadLabel.textContent='Reintentar descarga';}
 }finally{controller=null;progress.hidden=true;downloadButton.disabled=false;}
}
downloadButton.addEventListener('click',downloadInstaller);
document.getElementById('cancel-download').addEventListener('click',()=>controller?.abort());
document.getElementById('copy-link').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(window.location.origin+'/#descargar');message('Enlace copiado. Ábrelo en tu PC con Windows para descargar la aplicación.');}
 catch{message('Copia la dirección de esta página desde la barra de tu navegador.');}
});
window.addEventListener('beforeunload',event=>{if(controller){event.preventDefault();event.returnValue='';}});
loadVersion();
