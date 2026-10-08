'use strict';
const {app, BrowserWindow, Menu, protocol, session, dialog, shell, ipcMain, safeStorage} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {ORIGIN, internalURL, externalURL, assetPath, CSP} = require('./policy.cjs');
app.setName('Control Emprende');
// Fixed location across updates; separate from browser and cloud accounts.
app.setPath('userData', !app.isPackaged && process.env.CE_TEST_DATA_DIR && path.isAbsolute(process.env.CE_TEST_DATA_DIR) ? process.env.CE_TEST_DATA_DIR : path.join(app.getPath('appData'), 'ControlEmprende'));
app.setAppUserModelId('cl.controlemprende.desktop');
protocol.registerSchemesAsPrivileged([{scheme:'ce-app', privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let mainWindow, license, licenseTimer, refreshTimer, checkoutTimer;
let lastRefresh=0;
async function refreshLicense(){lastRefresh=Date.now();return license.refresh();}
async function setupLicense(){
 const test=!app.isPackaged && process.env.CE_TEST_LICENSE_CONFIG && process.env.CE_TEST_DATA_DIR && path.isAbsolute(process.env.CE_TEST_DATA_DIR);
 const config=JSON.parse(await fs.readFile(test?process.env.CE_TEST_LICENSE_CONFIG:path.join(__dirname,'license-config.json'),'utf8'));
 const options={dir:app.getPath('userData'),config,safeStorage,test:Boolean(test),onChange:value=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('ce-license:changed',value);}};
 // Explicit development harness only; packaged Windows always uses DPAPI.
 if(test&&process.platform!=='win32')options.safeStorage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};
 if(test){options.getDeviceId=async()=>require('node:crypto').createHash('sha256').update(app.getPath('userData')).digest('hex');}
 license=require('./license-client.cjs').createLicenseClient(options);
 const trusted=event=>event.sender===mainWindow?.webContents && event.senderFrame===mainWindow.webContents.mainFrame && internalURL(event.senderFrame.url);
 for(const [name,action] of Object.entries({status:()=>license.status(),refresh:()=>refreshLicense(),authorize:()=>license.authorizeWrite(),checkout:async()=>{
  const result=await license.checkout();await shell.openExternal(result.url);
  clearInterval(checkoutTimer);const until=Date.now()+600000;
  checkoutTimer=setInterval(()=>{if(Date.now()>until){clearInterval(checkoutTimer);return;}void refreshLicense();},15000);
  return {opened:true,mode:result.mode};
 }}))ipcMain.handle('ce-license:'+name,async event=>{if(!trusted(event))throw Error('Solicitud no permitida.');return action();});
 licenseTimer=setInterval(()=>void license.tick(),5000);
 refreshTimer=setInterval(()=>void refreshLicense(),300000);
}
app.on('before-quit',()=>{clearInterval(licenseTimer);clearInterval(refreshTimer);clearInterval(checkoutTimer);});
let openingExternal = false;
async function openExternal(url) {
  if (!externalURL(url) || openingExternal) return;
  openingExternal = true;
  try {
    const {response} = await dialog.showMessageBox(mainWindow, {type:'question',title:'Abrir enlace',message:'¿Abrir este enlace en tu navegador?',detail:new URL(url).hostname,buttons:['Cancelar','Abrir navegador'],defaultId:0,cancelId:0,noLink:true});
    if (response === 1) await shell.openExternal(url);
  } catch { dialog.showErrorBox('No pudimos abrir el enlace','Abre tu navegador e inténtalo nuevamente.'); }
  finally { openingExternal = false; }
}
function createWindow() {
  mainWindow = new BrowserWindow({title:'Control Emprende · Mi negocio',width:1440,height:960,minWidth:850,minHeight:600,show:false,backgroundColor:'#0f172a',icon:path.join(__dirname,'resources/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,spellcheck:true}});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.on('focus',()=>{if(license&&Date.now()-lastRefresh>30000)void refreshLicense();});
  mainWindow.webContents.setWindowOpenHandler(({url})=>{void openExternal(url);return {action:'deny'};});
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(!internalURL(url)){event.preventDefault();void openExternal(url);}});
  mainWindow.webContents.on('will-redirect',(event,url)=>{if(!internalURL(url))event.preventDefault();});
  mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
  mainWindow.webContents.on('will-prevent-unload',event=>{
    const choice=dialog.showMessageBoxSync(mainWindow,{type:'question',title:'Cambios sin guardar',message:'Hay cambios sin guardar. ¿Salir de esta pantalla?',buttons:['Seguir editando','Descartar y salir'],defaultId:0,cancelId:0,noLink:true});
    if(choice===1)event.preventDefault();
  });
  mainWindow.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)dialog.showErrorBox('No pudimos abrir la aplicación','Cierra y vuelve a abrir Control Emprende. Tus datos guardados se conservan.');});
  mainWindow.on('closed',()=>{mainWindow=null;});
  mainWindow.loadURL(ORIGIN+'/');
}
if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
  app.whenReady().then(async()=>{
    session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback(permission==='clipboard-sanitized-write' && internalURL(wc.getURL())));
    session.defaultSession.setPermissionCheckHandler((wc,permission)=>permission==='clipboard-sanitized-write' && Boolean(wc) && internalURL(wc.getURL()));
    // This edition stores the owner's business data locally; network services are disabled.
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!internalURL(details.url)&&!details.url.startsWith('blob:'+ORIGIN+'/')&&!details.url.startsWith('data:')}));
    protocol.handle('ce-app',async request=>{
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
      const file=assetPath(request.url,path.join(__dirname,'web'));
      if(!file)return new Response('Not found',{status:404});
      try{
        const stat=await fs.stat(file);if(!stat.isFile())return new Response('Not found',{status:404});
        const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2'}[path.extname(file)] || 'application/octet-stream';
        return new Response(request.method==='HEAD'?null:await fs.readFile(file),{status:200,headers:{'Content-Type':mime,'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff'}});
      }catch{return new Response('Not found',{status:404});}
    });
    session.defaultSession.on('will-download',(_event,item)=>{
      const name=path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
      item.setSaveDialogOptions({title:'Guardar archivo de Control Emprende',defaultPath:path.join(app.getPath('downloads'),name),buttonLabel:'Guardar'});
      item.once('done',(_e,state)=>{if(state!=='completed'&&state!=='cancelled')dialog.showErrorBox('No se guardó el archivo','Vuelve a exportarlo y elige una carpeta donde puedas guardar.');});
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'Archivo',submenu:[{label:'Carpeta de descargas',click:()=>shell.openPath(app.getPath('downloads'))},{type:'separator'},{label:'Salir',role:'quit'}]},
      {label:'Editar',submenu:[{label:'Deshacer',role:'undo'},{label:'Rehacer',role:'redo'},{type:'separator'},{label:'Cortar',role:'cut'},{label:'Copiar',role:'copy'},{label:'Pegar',role:'paste'},{label:'Seleccionar todo',role:'selectAll'}]},
      {label:'Vista',submenu:[{label:'Recargar',role:'reload'},{type:'separator'},{label:'Tamaño original',role:'resetZoom'},{label:'Acercar',role:'zoomIn'},{label:'Alejar',role:'zoomOut'},{label:'Pantalla completa',role:'togglefullscreen'}]},
      {label:'Ayuda',submenu:[{label:'Acerca de esta versión',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'Control Emprende',message:'Control Emprende '+app.getVersion(),detail:'Edición local para Windows.\n\nConfigura tu negocio y trabaja con tus propios productos, clientes y ventas. La información se guarda en este equipo. Prueba de 15 días y acceso de 30 días por $9.990 CLP. Renovación manual. La licencia requiere Internet al iniciar y periódicamente. Esta edición usa pagos de prueba.\n\nAntes de cambiar de equipo, exporta un respaldo desde Ajustes. Esta versión se actualiza instalando una nueva edición.',buttons:['Entendido']})}]}
    ]));
    await setupLicense();
    createWindow();
    void refreshLicense();
  }).catch(error=>{dialog.showErrorBox('No se pudo iniciar Control Emprende',error.message);app.quit();});
  app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
  app.on('window-all-closed',()=>app.quit());
}
