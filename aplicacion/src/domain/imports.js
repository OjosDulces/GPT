import { newId, csvCell } from './data.js';
export const normalizeHeader = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_');
export function parseDelimited(text) {
  text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/,1)[0],delimiter=first.split(';').length>first.split(',').length?';':',';
  let quote=false,cell='',row=[],rows=[];
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quote&&text[i+1]==='"'){cell+='"';i++;}else if(quote || !cell)quote=!quote;else throw new Error('Hay comillas fuera de lugar en el archivo.'); }
    else if(!quote&&c===delimiter){row.push(cell);cell='';}
    else if(!quote&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quote)throw new Error('Hay una celda con comillas sin cerrar.');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
export function previewImport(rows, kind, existing = [], industry='comercio') {
  if(!['products','customers'].includes(kind))throw new Error('Tipo de importación no válido.');
  if(rows.length<2)throw new Error('Incluye los encabezados y al menos una fila.');
  if(rows.length>5001)throw new Error('Importa hasta 5.000 filas por archivo.');
  const headers=rows[0].map(normalizeHeader), required=kind==='products'?['nombre','precio']:['nombre'];
  if(new Set(headers).size!==headers.length)throw new Error('Hay encabezados duplicados.');
  if(required.some(h=>!headers.includes(h)))throw new Error(`Faltan columnas: ${required.filter(h=>!headers.includes(h)).join(', ')}.`);
  const names=new Set(existing.map(r=>normalizeHeader(r.name)));
  const additions=[],errors=[],skipped=[];
  rows.slice(1).forEach((values,i)=>{
    if(values.every(v=>!String(v??'').trim()))return;
    try {
      if(values.length>headers.length)throw new Error('Hay más celdas que encabezados.');
      const row=Object.fromEntries(headers.map((h,j)=>[h,String(values[j]??'').trim()]));
      if(!row.nombre || row.nombre.length>120)throw new Error('Nombre vacío o mayor a 120 caracteres.');
      if(Object.values(row).some(v=>v.length>1000))throw new Error('Una celda supera 1.000 caracteres.');
      if(Object.values(row).some(v=>/^[=+@]/.test(v)&&v!==row.telefono))throw new Error('No se admiten fórmulas. Pega valores.');
      if(names.has(normalizeHeader(row.nombre))){skipped.push({row:i+2,name:row.nombre});return;}
      const number=(field,fallback=0)=>{const raw=row[field];if(!raw)return fallback;if(!/^\d+(?:[.,]\d+)?$/.test(raw))throw new Error(`${field}: usa números sin separador de miles.`);const n=Number(raw.replace(',','.'));if(!Number.isFinite(n)||n>1e12)throw new Error(`${field}: valor fuera de rango.`);return n;};
      let item;
      if(kind==='products') {
        if(!row.precio)throw new Error('Falta el precio.');
        if(row.control_stock&&!['si','sí','no'].includes(row.control_stock.toLowerCase()))throw new Error('control_stock debe ser si o no.');
        item={id:newId('prod'),name:row.nombre,price:number('precio'),category:row.categoria||'General',stock:number('stock'),minStock:number('stock_minimo'),otherCost:number('costo'),laborCost:0,recipe:[],costing:{enabled:false,recipe:[],yieldQty:1},active:true,trackStock:row.control_stock?row.control_stock.toLowerCase()!=='no':industry!=='servicios',createdAt:new Date().toISOString()};
      } else item={id:newId('cli'),name:row.nombre,phone:row.telefono||'',notes:row.notas||'',createdAt:new Date().toISOString()};
      additions.push(item);names.add(normalizeHeader(row.nombre));
    }catch(e){errors.push({row:i+2,message:e.message});}
  });
  return {additions,errors,skipped,total:rows.length-1};
}
export function templateCSV(kind) {
  const rows=kind==='products'?[['nombre','precio','costo','stock','stock_minimo','categoria','control_stock'],['Producto de ejemplo',10000,5000,20,5,'General','si']]:[['nombre','telefono','notas'],['Cliente de ejemplo','56912345678','']];
  return '\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
}

