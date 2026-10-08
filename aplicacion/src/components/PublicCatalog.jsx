import React,{useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Clock,MapPin,MessageCircle,Package,Search,Store} from 'lucide-react';
import {CATALOG_THEMES,catalogImage,validCatalogSlug,whatsappLink} from '../domain/catalog.js';
import {formatMoney} from '../domain/business.js';
import {readPublicCatalog} from '../lib/catalogService.js';
import '../catalog.css';

export function CatalogView({catalog,preview=false}) {
 const {settings:s,products,currency}=catalog;
 const [query,setQuery]=useState(''),[category,setCategory]=useState('Todos');
 const categories=useMemo(()=>['Todos',...new Set(products.map(p=>p.category||'Otros'))],[products]);
 const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const visible=products.filter(p=>(category==='Todos'||p.category===category)&&normalize(`${p.name} ${p.description} ${p.category}`).includes(normalize(query)));
 const contact=whatsappLink(s.whatsapp,s.name), theme=CATALOG_THEMES[s.theme]||CATALOG_THEMES.bosque;
 return <div className={`ce-store ce-store-${s.layout==='simple'?'simple':'editorial'}`} style={{'--store-accent':theme.color}}>
  <div className="store-wrap">
   <header className="store-header"><a href="#catalog-products" className="store-brand"><span className="store-monogram" aria-hidden="true">{s.name.slice(0,2).toUpperCase()}</span><strong>{s.name}</strong></a><span className="store-header-label">Catálogo en línea</span></header>
   <section className="store-hero"><div><span className="store-kicker">CONOCE NUESTRO NEGOCIO</span><h1>{s.headline||s.name}</h1>{s.description&&<p className="store-intro">{s.description}</p>}<div className="store-hero-actions"><a className="store-button" href="#catalog-products">Explorar productos <ArrowUpRight size={18}/></a>{contact&&<a className="store-contact" href={contact} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Escríbenos</a>}</div><div className="store-details">{s.location&&<span><MapPin size={16}/>{s.location}</span>}{s.hours&&<span><Clock size={16}/>{s.hours}</span>}</div></div>
    <div className="store-feature" aria-hidden="true"><div className="store-feature-label">HECHO PARA TI <span>↗</span></div>{products[0]?.image?<img src={catalogImage(products[0].image)} alt=""/>:<div className="store-feature-placeholder"><Store size={68} strokeWidth={1}/><span>{s.name}</span></div>}<div className="store-feature-caption"><span>{products[0]?.category||'Nuestra selección'}</span><strong>{products[0]?.name||'Tu próximo favorito está aquí.'}</strong></div></div>
   </section>
   <main id="catalog-products" className="store-products"><div className="store-section-heading"><div><span className="store-kicker">NUESTRA SELECCIÓN</span><h2>Encuentra tu próximo favorito.</h2></div><span>{products.length} {products.length===1?'producto':'productos'}</span></div>
    <div className="store-tools"><label className="store-search"><Search size={20}/><input type="search" aria-label="Buscar productos" placeholder="¿Qué estás buscando?" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="store-category">Categoría<select aria-label="Filtrar por categoría" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
    <p className="store-results" role="status">{visible.length} {visible.length===1?'producto disponible para explorar':'productos disponibles para explorar'}</p>
    {visible.length?<div className="store-grid">{visible.map((p,i)=><article className="store-card" key={p.id}><div className="store-product-image">{catalogImage(p.image)?<img src={catalogImage(p.image)} alt={p.name} loading={i<3?'eager':'lazy'} decoding="async" onError={e=>{e.currentTarget.hidden=true;}}/>:<Package size={48} strokeWidth={1}/>}</div><div className="store-card-body"><span className="store-card-category">{p.category}</span><h3>{p.name}</h3>{p.description&&<p>{p.description}</p>}<div className="store-card-bottom"><strong>{p.price===null?'Consulta el precio':formatMoney(p.price,{currency})}</strong>{contact&&<a href={whatsappLink(s.whatsapp,s.name,p.name)} target="_blank" rel="noopener noreferrer" aria-label={`Consultar por ${p.name}`}><ArrowUpRight size={20}/></a>}</div></div></article>)}</div>:<div className="store-empty"><Package size={32}/><h3>{products.length?'No encontramos ese producto.':'Pronto habrá novedades.'}</h3><p>{products.length?'Prueba con otro nombre o categoría.':'Vuelve a visitarnos para descubrir nuestra selección.'}</p>{products.length>0&&<button onClick={()=>{setQuery('');setCategory('Todos');}}>Ver todos los productos</button>}</div>}
   </main>
   <footer className="store-footer"><div><strong>{s.name}</strong><p>Consulta disponibilidad y condiciones directamente con el negocio.</p></div><a href="/" target={preview?'_blank':undefined} rel="noopener noreferrer">Creado con Control Emprende <ArrowUpRight size={14}/></a></footer>
  </div>
 </div>;
}
export default function PublicCatalog({slug}) {
 const [state,setState]=useState({loading:true}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let alive=true;setState({loading:true});
  if(!validCatalogSlug(slug)){setState({missing:true});return()=>controller.abort();}
  readPublicCatalog(slug,controller.signal).then(data=>{if(alive)setState(data?{catalog:data}:{missing:true});}).catch(error=>{if(alive)setState({error:error.message==='CATALOG_NOT_CONFIGURED'?'Este catálogo todavía no está habilitado.':'No pudimos cargar el catálogo. Revisa tu conexión e inténtalo otra vez.'});});
  return()=>{alive=false;controller.abort();};
 },[slug,attempt]);
 useEffect(()=>{const old=document.title;document.title=state.catalog?`${state.catalog.settings.name} · Catálogo`:'Catálogo · Control Emprende';return()=>{document.title=old;};},[state.catalog]);
 if(state.catalog)return <CatalogView catalog={state.catalog}/>;
 return <main className="store-state"><Store size={42}/><h1>{state.loading?'Abriendo el catálogo…':state.missing?'Esta página no está disponible.':'No se pudo abrir la página.'}</h1><p role="status">{state.error||(state.missing?'Revisa el enlace o consulta con el negocio.':'Un momento, estamos buscando sus productos.')}</p>{state.error&&<button className="store-button" onClick={()=>setAttempt(n=>n+1)}>Reintentar</button>}</main>;
}
