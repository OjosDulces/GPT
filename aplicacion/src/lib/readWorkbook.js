// Minimal XLSX reader: first worksheet, values only, strict size and row limits.
// No macros, external links, formula evaluation or legacy binary XLS support.
const MAX_EXPANDED=10*1024*1024;
const xml=s=>{const doc=new DOMParser().parseFromString(s,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('El Excel contiene XML inválido.');return doc;};
const nodes=(root,tag)=>[...root.getElementsByTagName('*')].filter(el=>el.localName===tag);
export async function readWorkbook(file) {
  if(file.size>5*1024*1024)throw new Error('El archivo supera 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer),decoder=new TextDecoder();
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('No es un archivo XLSX válido.');
  const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true),total=0;const entries=new Map();
  if(count>1000)throw new Error('El libro tiene demasiados archivos internos.');
  for(let i=0;i<count;i++){
    if(offset+46>bytes.length||view.getUint32(offset,true)!==0x02014b50)throw new Error('Archivo Excel dañado.');
    const method=view.getUint16(offset+10,true),compressed=view.getUint32(offset+20,true),size=view.getUint32(offset+24,true),length=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true),name=decoder.decode(bytes.slice(offset+46,offset+46+length));
    if(view.getUint16(offset+8,true)&1)throw new Error('Quita la contraseña del archivo antes de importarlo.');
    total+=size;if(total>MAX_EXPANDED)throw new Error('El contenido descomprimido supera 10 MB.');
    entries.set(name,{method,compressed,size,local});offset+=46+length+extra+comment;
  }
  async function read(name) {
    const entry=entries.get(name);if(!entry)return null;
    const {method,compressed,size,local}=entry;
    if(local+30>bytes.length||view.getUint32(local,true)!==0x04034b50)throw new Error('Archivo Excel dañado.');
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(start+compressed>bytes.length)throw new Error('Archivo Excel incompleto.');
    const data=bytes.slice(start,start+compressed);
    if(method===0){if(data.length!==size)throw new Error('Tamaño inválido.');return decoder.decode(data);}
    if(method!==8)throw new Error('Compresión no compatible. Guarda el libro nuevamente como XLSX.');
    let stream;try{stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw new Error('Actualiza tu navegador o exporta el Excel como CSV.');}
    const reader=stream.getReader();let length=0;const chunks=[];
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_EXPANDED||length>size){await reader.cancel();throw new Error('Tamaño de Excel inválido.');}chunks.push(value);}
    if(length!==size)throw new Error('Archivo Excel incompleto.');
    const output=new Uint8Array(length);let at=0;for(const chunk of chunks){output.set(chunk,at);at+=chunk.length;}return decoder.decode(output);
  }
  const workbook=xml(await read('xl/workbook.xml')||''),rels=xml(await read('xl/_rels/workbook.xml.rels')||'');
  const sheet=nodes(workbook,'sheet')[0],id=sheet?.getAttribute('r:id'),relationship=nodes(rels,'Relationship').find(r=>r.getAttribute('Id')===id);
  const target=relationship?.getAttribute('Target');
  if(!target||relationship.getAttribute('TargetMode')==='External')throw new Error('No hay una hoja de datos válida.');
  const path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
  if(path.includes('..'))throw new Error('La ruta de la hoja no es compatible.');
  const sharedText=await read('xl/sharedStrings.xml'),shared=sharedText?nodes(xml(sharedText),'si').map(si=>nodes(si,'t').map(t=>t.textContent).join('')):[];
  const content=await read(path);if(!content)throw new Error('No se encontró la primera hoja.');
  const worksheet=xml(content),rows=nodes(worksheet,'row');if(rows.length>5001)throw new Error('Importa hasta 5.000 filas.');
  return rows.map(row=>{const values=[];for(const cell of nodes(row,'c')){
    if(nodes(cell,'f').length)throw new Error('El archivo contiene fórmulas. Copia y pega solo valores antes de importarlo.');
    const reference=cell.getAttribute('r')||'',letters=reference.replace(/\d/g,''),column=[...letters].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;
    if(column<0||column>29)throw new Error('Utiliza hasta 30 columnas con encabezados.');
    const type=cell.getAttribute('t'),value=nodes(cell,'v')[0]?.textContent||'';
    values[column]=type==='s'?(shared[Number(value)]||''):type==='inlineStr'?nodes(cell,'t').map(n=>n.textContent).join(''):value;
  }return Array.from({length:values.length},(_,i)=>values[i]||'');});
}

