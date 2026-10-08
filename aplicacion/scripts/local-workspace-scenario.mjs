import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function exerciseLocalWorkspace(page,downloadFile){
 page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());
 await page.getByRole('heading',{name:'Hagamos espacio para tu negocio'}).waitFor();
 const before=await page.evaluate(()=>window.storage.getSnapshot());
 for(const key of ['products','customers','sales','insumos','expenses','suppliers','productions','movements','quotes'])assert.deepEqual(before[key],[],key+' must start empty');
 assert.equal(await page.getByRole('combobox',{name:'Negocio de demostración'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Reiniciar demo'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Cerrar sesión'}).count(),0);
 assert.match(await page.locator('.ce-local-bar').innerText(),/Tus datos permanecen/);
 await page.getByLabel('Nombre del negocio',{exact:true}).fill('Mi negocio QA');
 await page.getByLabel('¿A qué te dedicas?').selectOption('otro');
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByLabel('Moneda',{exact:true}).selectOption('CLP');
 await page.getByLabel(/^Inventario/).selectOption('automatic');
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByRole('button',{name:'Empezar con mi negocio',exact:true}).click();
 await page.waitForFunction(async()=> (await window.storage.getSnapshot()).profile.onboardingComplete);
 const nav=page.getByRole('navigation',{name:'Navegación principal'});
 await nav.getByRole('button',{name:'Importar Excel / CSV',exact:true}).click();
 await page.getByLabel('Archivo para importar').setInputFiles({name:'mis-productos.csv',mimeType:'text/csv',buffer:Buffer.from('nombre;precio;costo;stock;stock_minimo\nProducto propio QA;2500;1000;5;1\n')});
 await page.getByRole('button',{name:'Confirmar importación de 1 registros'}).click();await page.getByText('1 registros importados correctamente.',{exact:true}).waitFor();
 await page.getByLabel('Tipo de importación').selectOption('customers');
 await page.getByLabel('Archivo para importar').setInputFiles({name:'mis-clientes.csv',mimeType:'text/csv',buffer:Buffer.from('nombre;telefono;notas\nCliente propio QA;56912345678;Registro de prueba automatizada\n')});
 await page.getByRole('button',{name:'Confirmar importación de 1 registros'}).click();await page.getByText('1 registros importados correctamente.',{exact:true}).waitFor();
 async function sale(){await page.getByRole('button',{name:'Nueva venta',exact:true}).first().click();await page.getByRole('button',{name:/Producto propio QA/}).click();await page.getByRole('button',{name:'Registrar venta',exact:true}).click();await page.getByText('Venta lista ·',{exact:false}).waitFor();}
 await sale();
 const after=await page.evaluate(()=>window.storage.getSnapshot());assert.equal(after.products.length,1);assert.equal(after.customers.length,1);assert.equal(after.sales.length,1);assert.equal(after.products[0].stock,4);assert.equal(after.sales[0].total,2500);
 await page.getByRole('button',{name:'Personalizar mi espacio',exact:true}).click();await page.getByRole('button',{name:'Paleta Órbita'}).click();await page.getByRole('button',{name:'Aplicar mi estilo',exact:true}).click();
 await nav.getByRole('button',{name:'Mi página web',exact:true}).click();await page.getByRole('button',{name:'Seleccionar todos',exact:true}).click();await page.getByRole('button',{name:'Guardar diseño local',exact:true}).click();await page.getByText('Diseño guardado en este equipo.',{exact:false}).waitFor();assert(await page.getByRole('button',{name:'Publicar página',exact:true}).isDisabled());
 await nav.getByRole('button',{name:'Plan y pagos',exact:true}).click();await page.getByRole('heading',{name:'Prueba de 15 días'}).waitFor();assert.equal(await page.getByRole('button',{name:'Ver opción de pago'}).count(),0);
 await nav.getByRole('button',{name:'Ayuda y soporte',exact:true}).click();await page.getByRole('heading',{name:'Empieza con tus propios datos'}).waitFor();
 await nav.getByRole('button',{name:'Metas y asesor',exact:true}).click();assert.equal(await page.getByRole('checkbox').count(),0);
 await nav.getByRole('button',{name:'Informes',exact:true}).click();const report=await downloadFile(page.getByRole('button',{name:'Descargar informe',exact:true}),'informe.csv');assert((await readFile(report,'utf8')).includes('Mi negocio QA'));
 async function backups(){await nav.getByRole('button',{name:'Ajustes',exact:true}).click();await page.getByRole('button',{name:'Datos y respaldo',exact:true}).click();}
 await backups();const backup=await downloadFile(page.getByRole('button',{name:'Descargar respaldo',exact:true}),'respaldo.json');const data=JSON.parse(await readFile(backup,'utf8'));assert.equal(data.data.sales.length,1);assert.equal(data.data.profile.name,'Mi negocio QA');
 await sale();assert.equal((await page.evaluate(()=>window.storage.getSnapshot())).sales.length,2);
 await backups();await page.getByLabel('Importar respaldo',{exact:false}).setInputFiles(backup);await page.getByText('Respaldo restaurado completamente.',{exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.storage.getSnapshot())).sales.length,1);
 await mkdir(new URL('../../pruebas/',import.meta.url),{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL('../../pruebas/datos-propios.png',import.meta.url)),fullPage:true});
 return data.data;
}
export async function assertLocalPersistence(page,data){
 await page.locator('.ce-v4').waitFor();const restored=await page.evaluate(()=>window.storage.getSnapshot());
 for(const key of ['products','sales','customers','profile'])assert.deepEqual(restored[key],data[key]);
 assert.equal(await page.locator('.ce-v4').evaluate(el=>el.style.getPropertyValue('--ce-accent')),'#8b5cf6');
 assert.equal(await page.getByRole('heading',{name:'Hagamos espacio para tu negocio'}).count(),0);
}
