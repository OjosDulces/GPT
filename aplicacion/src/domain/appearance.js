export const PALETTES = [
 {id:'emerald',name:'Impulso',description:'Azul noche y verde vivo',accent:'#10b981'},
 {id:'blue',name:'Horizonte',description:'Azul eléctrico y claridad',accent:'#4675ef'},
 {id:'violet',name:'Órbita',description:'Un toque más creativo',accent:'#8b5cf6'},
 {id:'copper',name:'Origen',description:'Cálido, cercano y propio',accent:'#db754c'},
 {id:'rose',name:'Estudio',description:'Rosa con carácter',accent:'#d85d92'},
 {id:'teal',name:'Calma',description:'Turquesa y equilibrio',accent:'#14a8ad'},
];
export const WIDGETS=[{id:'activity',name:'Tu movimiento',description:'Ventas de los últimos siete días'},{id:'agenda',name:'Tu próxima entrega',description:'Pedidos que necesitan avanzar'},{id:'insights',name:'Tu siguiente decisión',description:'Prioridades explicadas por el asesor'},{id:'goal',name:'Tu objetivo del mes',description:'Avance hacia tu meta de ventas'}];
export const SHORTCUTS=[{id:'venta',name:'Nueva venta'},{id:'gasto',name:'Registrar gasto'},{id:'catalogo',name:'Productos'},{id:'clientes',name:'Clientes'},{id:'cotizaciones',name:'Cotizaciones'},{id:'inventario',name:'Inventario'},{id:'informes',name:'Informes'},{id:'asesor',name:'Mi asesor'}];
export const DEFAULT_APPEARANCE=Object.freeze({palette:'emerald',customAccent:'',theme:'light',density:'comfortable',textSize:'normal',workspaceName:'',workspaceMotto:'Cada decisión cuenta. Este es tu espacio para avanzar.',workspaceLogo:'',dashboardLayout:'panorama',widgetOrder:WIDGETS.map(x=>x.id),hiddenWidgets:[],shortcuts:['venta','gasto','catalogo','clientes'],showQuickActions:true,reduceMotion:false});
const unique=(items,allowed)=>[...new Set((Array.isArray(items)?items:[]).filter(x=>allowed.includes(x)))];
export function normalizeAppearance(value={}){
 const s={...DEFAULT_APPEARANCE,...value},legacy={classic:'emerald',premium:'copper',chocolate:'copper',minimal:'blue'};
 s.palette=legacy[s.palette]||s.palette;if(!PALETTES.some(p=>p.id===s.palette))s.palette='emerald';
 s.customAccent=/^#[0-9a-f]{6}$/i.test(s.customAccent)?s.customAccent.toLowerCase():'';
 if(!['light','dark','system'].includes(s.theme))s.theme='light';
 if(!['comfortable','compact'].includes(s.density))s.density='comfortable';
 if(!['normal','large'].includes(s.textSize))s.textSize='normal';
 if(!['panorama','focus'].includes(s.dashboardLayout))s.dashboardLayout='panorama';
 for(const [key,max] of [['workspaceName',60],['workspaceMotto',110]])s[key]=String(s[key]||'').slice(0,max);
 s.workspaceLogo=typeof s.workspaceLogo==='string'&&s.workspaceLogo.length<200000&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(s.workspaceLogo)?s.workspaceLogo:'';
 const ids=WIDGETS.map(x=>x.id);s.widgetOrder=unique(s.widgetOrder,ids);s.widgetOrder.push(...ids.filter(id=>!s.widgetOrder.includes(id)));
 s.hiddenWidgets=unique(s.hiddenWidgets,ids);s.shortcuts=unique(s.shortcuts,SHORTCUTS.map(x=>x.id)).slice(0,4);
 if(!s.shortcuts.length)s.shortcuts=[...DEFAULT_APPEARANCE.shortcuts];
 return s;
}
export function luminance(hex){const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function readableColor(color,background){let rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16));const target=luminance(background)>.4?0:255;for(let i=0;i<40;i++){const hex='#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');if(contrast(hex,background)>=5.3)return hex;rgb=rgb.map(v=>v+(target-v)*.12);}return target?'#ffffff':'#000000';}
export function appearanceTokens(settings,dark=false){
 const s=normalizeAppearance(settings),accent=s.customAccent||PALETTES.find(p=>p.id===s.palette).accent,surface=dark?'#172233':'#ffffff';
 return {'--ce-accent':accent,'--ce-on-accent':contrast(accent,'#0f172a')>=4.5?'#0f172a':contrast(accent,'#ffffff')>=4.5?'#ffffff':'#000000','--ce-accent-text':readableColor(accent,surface),'--ce-bg':dark?'#0d1523':'#f4f6fa','--ce-surface':surface,'--ce-surface-soft':dark?'#202e42':'#f6f8fb','--ce-text':dark?'#edf3fd':'#17243b','--ce-muted':dark?'#b2bfd2':'#52637a','--ce-border':dark?'#314056':'#e4e9f1','--ce-accent-soft':dark?`${accent}22`:`${accent}14`,'--color-choco':dark?'#edf3fd':'#17243b','--color-choco-dark':dark?'#ffffff':'#0f172a','--color-crema':dark?'#0d1523':'#f4f6fa','--color-caramelo':readableColor(accent,surface),'--color-oro':accent,'--color-rosa':'#cb7350'};
}
export function initials(name){return String(name||'Mi negocio').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
