import React,{createContext,useContext,useState} from 'react';
export const LicenseContext=createContext({canWrite:false,status:'read_only',reason:'Comprobando licencia…'});
const date=n=>n?new Date(n).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'}):'Pendiente';
export function LicensePanel(){
 const license=useContext(LicenseContext),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action){setBusy(true);setMessage('');try{if(!window.desktopLicense)throw Error('Abre la aplicación instalada para activar tu licencia.');await window.desktopLicense[action]();if(action==='checkout')setMessage('Se abrió Mercado Pago. Usa tu comprador y tarjeta de prueba. Al volver, comprobaremos el pago automáticamente.');}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <section className="ce-panel ce-license-panel" id="licencia"><span className="ce-eyebrow">TU LICENCIA</span><h2 className="ce-panel-heading">{license.status==='trial'?'Prueba de 15 días':license.status==='active'?'Acceso activo':'Solo lectura'}</h2>
 {license.mode==='test'&&<p role="note" className="billing-notice">Versión para probar pagos. Usa únicamente cuentas y tarjetas de prueba de Mercado Pago; todavía no es la versión para vender a clientes.</p>}
 <p>{license.canWrite?`Puedes registrar operaciones. Quedan ${license.daysRemaining} días de acceso.`:license.reason}</p>
 <dl className="ce-license-dates"><div><dt>Fin de la prueba</dt><dd>{date(license.trialEndsAt)}</dd></div><div><dt>Acceso pagado hasta</dt><dd>{date(license.paidUntil)}</dd></div><div><dt>Comprobar por Internet antes de</dt><dd>{date(license.verifyBefore)}</dd></div></dl>
 <h3>$9.990 CLP por 30 días</h3><p>Renovación manual, sin cobros recurrentes. El acceso se habilita cuando el servidor confirma el pago. Si compras antes del vencimiento, los 30 días se suman al período vigente.</p>
 <p>Al vencer puedes consultar, exportar y respaldar tus datos. Para registrar cambios, importar o restaurar respaldos necesitas acceso vigente. Los datos del negocio permanecen en este equipo.</p>
 <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="ce-button" disabled={busy||license.checking||!license.billingEnabled} onClick={()=>run('checkout')}>{busy?'Preparando…':license.mode==='test'?'Probar compra · $9.990 CLP':'Comprar 30 días · $9.990 CLP'}</button><button className="ce-button ce-button-secondary" disabled={busy||license.checking} onClick={()=>run('refresh')}>{license.checking?'Comprobando…':'Comprobar licencia y pago'}</button></div>
 {license.paymentCheckPending&&<p role="status">No pudimos consultar el pago todavía. Vuelve a comprobarlo antes de iniciar otra compra.</p>}
 {license.error&&<p role="alert" className="ce-error">{license.error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
