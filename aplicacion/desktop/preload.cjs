'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopLicense',Object.freeze({
 status:()=>ipcRenderer.invoke('ce-license:status'),
 refresh:()=>ipcRenderer.invoke('ce-license:refresh'),
 authorizeWrite:()=>ipcRenderer.invoke('ce-license:authorize'),
 checkout:()=>ipcRenderer.invoke('ce-license:checkout'),
 onChange:listener=>{if(typeof listener!=='function')return ()=>{};const handler=(_event,state)=>listener(state);ipcRenderer.on('ce-license:changed',handler);return ()=>ipcRenderer.removeListener('ce-license:changed',handler);}
}));
