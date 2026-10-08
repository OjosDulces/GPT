import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
export default function UpdateNotice() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if(!needRefresh) return null;
  return <div role="status" className="fixed bottom-24 left-3 right-3 sm:left-auto sm:w-96 z-[110] rounded-2xl border border-oro/30 bg-white text-choco p-4 shadow-xl"><strong className="text-sm">Hay una nueva versión</strong><p className="text-xs mt-1">Termina de guardar lo que estás haciendo antes de actualizar.</p><div className="flex gap-3 mt-3"><button className="ce-button" onClick={()=>updateServiceWorker(true)}>Actualizar ahora</button><button className="text-xs" onClick={()=>setNeedRefresh(false)}>Después</button></div></div>;
}
