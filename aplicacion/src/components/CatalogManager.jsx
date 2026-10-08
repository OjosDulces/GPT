import React,{useEffect,useMemo,useState} from 'react';
import {Check,Copy,ExternalLink,Eye,Globe,Package,Palette,Save,ShieldCheck} from 'lucide-react';
import {CatalogView} from './PublicCatalog.jsx';
import {CATALOG_THEMES,defaultCatalog,previewCatalog,validateCatalog} from '../domain/catalog.js';
import {scopedKey} from '../domain/business.js';
import {loadCatalogSettings,saveCatalogSettings} from '../lib/catalogService.js';
import {useDraftGuard} from './WorkspaceFeatures.jsx';
import '../catalog.css';

export default function CatalogManager({profile,products,goTo}) {
 const context=window.businessContext||{},demo=Boolean(context.demo||context.local),owner=context.role==='owner';
 const [draft,setDraft]=useState(()=>defaultCatalog(profile)),[saved,setSaved]=useState(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[view,setView]=useState('edit'),[filter,setFilter]=useState(''),[reload,setReload]=useState(0);
 const active=useMemo(()=>products.filter(p=>p.active!==false),[products]);
 const storageKey=scopedKey('ce-catalog-draft-v1');
 const baseline=saved?{...saved.settings,slug:saved.slug,productIds:saved.product_ids}:defaultCatalog(profile);
 const dirty=ready&&JSON.stringify(draft)!==JSON.stringify(baseline);
 useDraftGuard(dirty);
 useEffect(()=>{
  if(!owner)return;
  let alive=true;setReady(false);setError('');
  (async()=>{try{
   const row=demo?JSON.parse(localStorage.getItem(storageKey)||'null'):await loadCatalogSettings(context.id);
   if(!alive)return;
   setSaved(row);setDraft(row?{...row.settings,slug:row.slug,productIds:row.product_ids}:defaultCatalog(profile));setReady(true);
  }catch{if(alive)setError('No pudimos cargar la configuración. Reintenta; si es la primera instalación, comprueba que esté aplicada la migración de catálogos.');}})();
  return()=>{alive=false;};
 },[context.id,demo,owner,reload,storageKey]);
 const set=(key,value)=>{setDraft(d=>({...d,[key]:value}));setError('');setMessage('');};
 const preview=useMemo(()=>previewCatalog(draft,products,profile.currency),[draft,products,profile.currency]);
 const publicUrl=saved?.published&&!demo?`${window.location.origin}/catalogo/${saved.slug}`:'';
 async function save(published) {
  setBusy(true);setMessage('');setError('');
  try{
   const settings=validateCatalog({...draft,productIds:draft.productIds.filter(id=>active.some(p=>p.id===id))},products);
   if(published&&!settings.productIds.length)throw new Error('Selecciona al menos un producto antes de publicar.');
   let row;
   if(context.local){const permission=await window.desktopLicense?.authorizeWrite();if(!permission?.canWrite)throw Error('Tu licencia está en modo de solo lectura.');}
   if(demo){row={slug:settings.slug,settings,product_ids:settings.productIds,version:(saved?.version||0)+1,published:false};localStorage.setItem(storageKey,JSON.stringify(row));}
   else row=await saveCatalogSettings(context.id,saved?.version||0,settings,published);
   setSaved(row);setDraft({...row.settings,slug:row.slug,productIds:row.product_ids});
   setMessage(demo?`Diseño guardado en este ${context.local?'equipo':'navegador'}. Esta vista previa no está publicada.`:published?'Tu página está publicada. Ya puedes compartir el enlace.':saved?.published?'Página retirada. El enlace dejó de mostrar el catálogo.':'Borrador guardado. Todavía no es público.');
  }catch(e){setError(e.code==='40001'?'La página cambió en otra sesión. Recarga la configuración para revisar la versión más reciente.':e.message||'No pudimos guardar la página.');}
  finally{setBusy(false);}
 }
 async function copy(){try{await navigator.clipboard.writeText(publicUrl);setMessage('Enlace copiado. Compártelo con tus clientes.');}catch{setError('No pudimos copiarlo automáticamente. Selecciona el enlace y cópialo.');}}
 function refresh(){if(!dirty||window.confirm('¿Descartar los cambios y recargar la página guardada?'))setReload(n=>n+1);}
 if(!owner)return <section className="ce-panel catalog-info"><ShieldCheck/><h3>La página la administra el propietario.</h3><p>Pídele que elija los productos y los datos que desea hacer públicos.</p></section>;
 if(!ready)return <section className="ce-panel catalog-info"><p role="status">{error||'Cargando tu página…'}</p>{error&&<button className="ce-button" onClick={refresh}>Reintentar</button>}</section>;
 const filtered=active.filter(p=>`${p.name} ${p.category}`.toLowerCase().includes(filter.toLowerCase()));
 return <fieldset className="catalog-manager" disabled={busy}>
  <section className="catalog-banner"><span className="catalog-banner-icon"><Globe size={28}/></span><div><span className="catalog-kicker">TU VITRINA, SIEMPRE A MANO</span><h3>Un enlace. Todo tu negocio a la vista.</h3><p>Elige qué mostrar y comparte tu página con tus clientes.</p></div><span className={`catalog-status ${saved?.published&&!demo?'is-live':''}`}><span/>{saved?.published&&!demo?'Publicada':'Sin publicar'}</span></section>
  {demo&&<p className="catalog-notice">Estás diseñando una vista previa local. Para compartirla por Internet necesitamos conectar las cuentas y alojar la aplicación.</p>}
  {publicUrl&&<div className="catalog-link-box"><label>Enlace de tu página<input readOnly value={publicUrl} onFocus={e=>e.target.select()}/></label><button className="ce-button ce-button-secondary" onClick={copy}><Copy size={17}/>Copiar</button><a className="ce-button ce-button-secondary" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>Abrir</a></div>}
  <div className="catalog-toolbar"><div><button aria-pressed={view==='edit'} onClick={()=>setView('edit')}><Palette size={17}/>Configurar</button><button aria-pressed={view==='preview'} onClick={()=>setView('preview')}><Eye size={17}/>Vista previa</button></div><span>{preview.products.length} productos seleccionados{dirty?' · Cambios sin guardar':''}</span></div>
  {error&&<p className="catalog-error" role="alert">{error} <button onClick={refresh}>Recargar configuración</button></p>}{message&&<p className="catalog-notice" role="status">{message}</p>}
  {view==='preview'?<section className="catalog-preview"><p>Vista previa de tus cambios. {saved?.published?'La página pública se actualiza al guardar.':'Todavía no es un enlace compartible.'}</p><CatalogView catalog={preview} preview/></section>:<div className="catalog-editor">
   <div className="catalog-editor-main">
    <section className="ce-panel catalog-section"><div className="catalog-section-title"><span>01</span><div><h3>La identidad de tu página</h3><p>Un espacio que se sienta tuyo.</p></div></div>
     <label>Nombre del negocio<input maxLength={100} value={draft.name} onChange={e=>set('name',e.target.value)}/></label>
     <label>Dirección de la página<div className="catalog-slug"><span>/catalogo/</span><input aria-label="Dirección de la página" maxLength={60} value={draft.slug} onChange={e=>set('slug',e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9-]/g,''))}/></div><small>No necesitas comprar un dominio. {saved?.published&&'Si cambias la dirección, el enlace anterior dejará de funcionar.'}</small></label>
     <label>Frase principal<input maxLength={120} value={draft.headline} onChange={e=>set('headline',e.target.value)}/></label>
     <label>Acerca de tu negocio<textarea rows={3} maxLength={800} placeholder="Cuenta qué hace especial a tu negocio." value={draft.description} onChange={e=>set('description',e.target.value)}/></label>
     <fieldset className="catalog-themes"><legend>Color de la página</legend>{Object.entries(CATALOG_THEMES).map(([key,t])=><button type="button" key={key} aria-pressed={draft.theme===key} onClick={()=>set('theme',key)}><span style={{background:t.color}}>{draft.theme===key&&<Check size={14}/>}</span>{t.label}</button>)}</fieldset>
     <label>Estilo de portada<select value={draft.layout} onChange={e=>set('layout',e.target.value)}><option value="editorial">Editorial · producto destacado</option><option value="simple">Simple · protagonismo al texto</option></select></label>
    </section>
    <section className="ce-panel catalog-section"><div className="catalog-section-title"><span>02</span><div><h3>Cómo te encuentran</h3><p>Estos datos serán visibles para cualquier visitante.</p></div></div><label>WhatsApp del negocio · opcional<input aria-label="WhatsApp del negocio · opcional" type="tel" inputMode="tel" maxLength={20} placeholder="56912345678" value={draft.whatsapp} onChange={e=>set('whatsapp',e.target.value.replace(/[^0-9]/g,''))}/><small>Incluye el código de país. El botón abrirá una consulta, sin enviar mensajes automáticamente.</small></label><label>Zona o dirección pública · opcional<input maxLength={160} placeholder="Por ejemplo: Providencia, Santiago" value={draft.location} onChange={e=>set('location',e.target.value)}/></label><label>Horario de atención · opcional<input maxLength={160} placeholder="Lunes a viernes, 9:00 a 18:00" value={draft.hours} onChange={e=>set('hours',e.target.value)}/></label></section>
   </div>
   <aside><section className="ce-panel catalog-section"><div className="catalog-section-title"><span>03</span><div><h3>Tu selección de productos</h3><p>Solo aparecerán los que marques aquí.</p></div></div><label className="catalog-check"><input type="checkbox" checked={draft.showPrices} onChange={e=>set('showPrices',e.target.checked)}/>Mostrar precios</label><label>Buscar en mis productos<input type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Nombre o categoría"/></label><div className="catalog-selection-actions"><button onClick={()=>set('productIds',active.slice(0,500).map(p=>p.id))}>Seleccionar {active.length>500?'primeros 500':'todos'}</button><button onClick={()=>set('productIds',[])}>Quitar selección</button></div><div className="catalog-selection">{filtered.map(p=><label key={p.id} className="catalog-product-choice"><input type="checkbox" checked={draft.productIds.includes(p.id)} onChange={e=>set('productIds',e.target.checked?[...draft.productIds,p.id]:draft.productIds.filter(id=>id!==p.id))}/><span className="catalog-product-icon"><Package size={20}/></span><span><strong>{p.name}</strong><small>{p.category||'Otros'}</small></span></label>)}{!filtered.length&&<p>{active.length?'No hay coincidencias.':'Agrega tus primeros productos para armar tu página.'}</p>}</div><button className="ce-button ce-button-secondary" onClick={()=>goTo('catalogo')}>Editar productos y fotos</button><p className="catalog-hint">Los precios, fotos y descripciones públicas se actualizan desde Productos. Los nuevos productos requieren que los selecciones; los archivados dejan de mostrarse.</p></section><div className="catalog-privacy"><ShieldCheck size={22}/><p>Los visitantes solo verán tu presentación y los productos elegidos. Los costos, existencias, clientes y ventas son privados.</p></div></aside>
  </div>}
  <div className="catalog-save-bar"><p>{saved?.published&&!demo?'Guardar aplica los cambios a tu página pública.':'Publicar hará visibles tu selección y los datos de contacto.'}</p><div>{saved?.published&&!demo&&<button className="ce-button ce-button-secondary" disabled={busy} onClick={()=>save(false)}>Retirar página</button>}<button className="ce-button ce-button-secondary" disabled={busy} onClick={()=>save(Boolean(saved?.published)&&!demo)}><Save size={17}/>{busy?'Guardando…':demo?'Guardar diseño local':saved?.published?'Guardar cambios':'Guardar borrador'}</button>{!saved?.published&&<button className="ce-button" disabled={demo||busy} title={demo?'Necesitas conectar las cuentas y alojar la aplicación.':undefined} onClick={()=>save(true)}><Globe size={17}/>Publicar página</button>}</div></div>
 </fieldset>;
}
