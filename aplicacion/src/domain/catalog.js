export const CATALOG_THEMES = { bosque: {label:'Bosque',color:'#195b48'}, terracota:{label:'Terracota',color:'#963f2c'}, oceano:{label:'Océano',color:'#245a88'}, uva:{label:'Uva',color:'#68417e'} };
export const catalogSlug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60).replace(/-$/,'');
export const validCatalogSlug = value => /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(value);
export function defaultCatalog(profile={}) { return {slug:catalogSlug(profile.name),name:profile.name||'Mi negocio',headline:'Descubre lo que tenemos para ti.',description:'',location:'',hours:'',whatsapp:'',theme:'bosque',layout:'editorial',showPrices:true,productIds:[]}; }
export function catalogImage(value) { const s=String(value||'');return s.length<=500000 && (/^https:\/\/[^\s]+$/.test(s)||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) ? s : ''; }
export function previewCatalog(settings,products,currency='CLP') {
 return {slug:settings.slug,settings,currency,products:products.filter(p=>p.active!==false&&settings.productIds.includes(p.id)).map(p=>({id:p.id,name:p.name,category:p.category||'Otros',description:String(p.publicDescription||'').slice(0,800),price:settings.showPrices?p.price:null,image:catalogImage(p.image)}))};
}
export function validateCatalog(s,products) {
 if(!validCatalogSlug(s.slug))throw new Error('La dirección necesita entre 3 y 60 letras minúsculas, números o guiones, sin guiones en los extremos.');
 if(s.name.trim().length<2||s.name.length>100)throw new Error('Escribe un nombre de entre 2 y 100 caracteres.');
 if(s.whatsapp&&!/^[1-9][0-9]{7,14}$/.test(s.whatsapp))throw new Error('Escribe el WhatsApp con código de país, solo números. Ejemplo: 56912345678.');
 if(s.productIds.length>500)throw new Error('Puedes mostrar hasta 500 productos en esta página.');
 if(s.productIds.some(id=>!products.some(p=>p.id===id&&p.active!==false)))throw new Error('Un producto ya no está disponible. Revisa la selección.');
 return s;
}
export function whatsappLink(phone,name,product) { return /^[1-9][0-9]{7,14}$/.test(phone||'') ? `https://wa.me/${phone}?text=${encodeURIComponent(product?`Hola, vi ${product} en el catálogo de ${name}. Me gustaría consultar.`:`Hola, vi el catálogo de ${name}. Me gustaría consultar.`)}` : ''; }
