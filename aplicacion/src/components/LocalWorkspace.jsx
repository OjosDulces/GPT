import React,{Suspense,lazy,useEffect,useState} from 'react';
import {createLocalStorage} from '../lib/localStorage.js';
import {AccessibleDialog} from './WorkspaceFeatures.jsx';
import {LicenseContext,LicensePanel} from './LicensePanel.jsx';
const BusinessApp=lazy(()=>import('../BusinessApp.jsx'));
const unavailable={canWrite:false,status:'read_only',reason:'Abre la aplicación instalada y conéctate a Internet para comprobar tu licencia.'};
export default function LocalWorkspace(){
 const [state,setState]=useState('loading'),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[license,setLicense]=useState(unavailable),[showLicense,setShowLicense]=useState(false);
 useEffect(()=>{
  let active=true;const receive=value=>{if(active){if(window.businessContext)window.businessContext.role=value.canWrite?'owner':'reader';setLicense(value);}};
  const unsubscribe=window.desktopLicense?.onChange(receive);
  window.desktopLicense?.status().then(receive).catch(e=>receive({...unavailable,error:e.message}));
  return()=>{active=false;unsubscribe?.();};
 },[]);
 useEffect(()=>{
  let active=true;const storage=createLocalStorage({authorizeWrite:()=>window.desktopLicense?.authorizeWrite()??Promise.resolve(unavailable)});
  setState('loading');setError('');
  storage.getSnapshot().then(()=>{
   if(!active)return;
   window.storage=storage;
   window.businessContext={id:'local-business',name:'Mi negocio',userId:'local',role:'reader',local:true};
   setState('ready');
  }).catch(e=>{if(active){setError(e.message);setState('error');}});
  return()=>{active=false;storage.dispose();if(window.storage===storage){delete window.storage;delete window.businessContext;}};
 },[attempt]);
 if(window.businessContext)window.businessContext.role=license.canWrite?'owner':'reader';
 if(state==='error')return <main className="ce-panel"><h1>No pudimos abrir tu negocio</h1><p role="alert">{error}</p><p>Tus datos no se han borrado. Cierra otras ventanas y comprueba el espacio del equipo.</p><button className="ce-button" onClick={()=>setAttempt(n=>n+1)}>Reintentar</button></main>;
 if(state!=='ready')return <p role="status">Abriendo tu negocio…</p>;
 return <LicenseContext.Provider value={license}><div className="ce-demo-bar ce-local-bar"><span><strong>{license.mode==='test'?'Prueba de pagos · ':''}{license.canWrite?`${license.status==='trial'?'Prueba':'Acceso'}: ${license.daysRemaining} días`:'Solo lectura'}</strong> · Tus datos permanecen en este equipo</span><button onClick={()=>setShowLicense(v=>!v)} style={{border:'1px solid currentColor',borderRadius:8,padding:'6px 12px',fontWeight:700}}>Mi licencia</button></div>{showLicense&&<AccessibleDialog title="Mi licencia" onClose={()=>setShowLicense(false)}><LicensePanel/></AccessibleDialog>}<Suspense fallback={<p role="status">Abriendo tu espacio…</p>}><BusinessApp/></Suspense></LicenseContext.Provider>;
}
