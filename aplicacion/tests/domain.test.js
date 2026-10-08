import test from 'node:test';
import assert from 'node:assert/strict';
import { saleInventory, purchaseInventory, productionInventory, financialSummary } from '../src/domain/operations.js';
import { validateBackup, emptyData, csvCell } from '../src/domain/data.js';
import { formatMoney } from '../src/domain/business.js';

test('Stock: agrupa dos líneas del mismo producto y no modifica el original', () => {
 const p=[{id:'p',name:'Alfajor',stock:10}], items=[{productId:'p',qty:2},{productId:'p',qty:3}];
 const next=saleInventory(p,items,{automatic:true});assert.equal(next.products[0].stock,5);assert.equal(next.movements.length,1);assert.equal(p[0].stock,10);
 assert.throws(()=>saleInventory(p,[{productId:'p',qty:11}],{automatic:true}),/insuficiente/);
 assert.equal(saleInventory(p,items).products[0].stock,10);
});
test('Servicios no consumen existencias y el reverso restituye cantidades agrupadas',()=>{
 assert.equal(saleInventory([{id:'s',stock:0,trackStock:false}],[{productId:'s',qty:5}],{automatic:true}).movements.length,0);
 assert.equal(saleInventory([{id:'p',stock:2}],[{productId:'p',qty:2},{productId:'p',qty:1}],{automatic:true,reverse:true}).products[0].stock,5);
});
test('Compras repetidas del mismo insumo suman cantidades y ponderan el costo',()=>{
 const original=[{id:'i',name:'Harina',stock:10,costPerUnit:2,costSource:'manual',unit:'g'}];
 const result=purchaseInventory(original,[{insumoId:'i',qty:5,totalPrice:20},{insumoId:'i',qty:5,totalPrice:30}],'compra','2026-09-13');
 assert.equal(result.insumos[0].stock,20);assert.equal(result.insumos[0].costPerUnit,3.5);assert.equal(result.movements.length,2);assert.equal(original[0].stock,10);
 assert.throws(()=>purchaseInventory(original,[{insumoId:'missing',qty:1,totalPrice:2}]),/existe/);
});
test('Producción agrupa recetas, comprueba todos los insumos y no genera stock parcial',()=>{
 const p=[{id:'p',name:'Pan',stock:0,recipe:[{insumoId:'i',qty:3},{insumoId:'i',qty:2}]}], i=[{id:'i',name:'Harina',stock:9}];
 assert.throws(()=>productionInventory(p,i,'p',2,4),/alcanza/);assert.equal(p[0].stock,0);assert.equal(i[0].stock,9);
 const r=productionInventory(p,i,'p',1,4);assert.equal(r.insumos[0].stock,4);assert.equal(r.products[0].stock,1);
});
test('Cobros de ventas anteriores se registran por fecha de pago; pendientes no salen de caja',()=>{
 const sales=[{id:'v',dateISO:'2026-08-01T12:00:00',total:100,paidAmount:70,payments:[{dateISO:'2026-08-01T12:00:00',amount:20},{dateISO:'2026-09-10T12:00:00',amount:50}]}];
 const expenses=[{dateISO:'2026-09-01T12:00:00',total:15,paymentStatus:'Pagado'},{dateISO:'2026-09-02T12:00:00',total:80,paymentStatus:'Pendiente'}];
 const r=financialSummary(sales,expenses,{from:'2026-09-01',to:'2026-09-30'});assert.equal(r.collected,50);assert.equal(r.cashFlow,35);assert.equal(r.billed,0);assert.equal(r.receivables,30);assert.equal(r.payables,80);
});
test('Los pagos históricos sin fecha no se inventan en el mes de la venta',()=>{
 const r=financialSummary([{dateISO:'2026-09-01T12:00:00',total:100,paidAmount:70}],[],{from:'2026-09-01',to:'2026-09-30'});assert.equal(r.collected,0);assert.equal(r.undatedCollections,70);
});
test('Restauración rechaza identificadores duplicados, listas dañadas y versiones futuras',()=>{
 const data=emptyData();assert.deepEqual(validateBackup({version:3,data}),data);
 assert.throws(()=>validateBackup({version:99,data}),/Versión/);
 assert.throws(()=>validateBackup({version:3,data:{...data,products:[{id:'p'},{id:'p'}]}}),/duplicados/);
 assert.throws(()=>validateBackup({version:3,data:{...data,sales:[{id:'v',items:[]}]}}),/detalle/);
 assert.throws(()=>validateBackup({version:3,data:{...data,expenses:{}}}),/incompleto/);
});
test('Exportación CSV neutraliza fórmulas y respeta comillas',()=>{
 assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');assert.equal(csvCell('Hola, Ana'),'"Hola, Ana"');assert.equal(csvCell('linea\ntexto'),'"linea\ntexto"');
});
test('La moneda diferencia CLP sin decimales de PEN con decimales',()=>{
 assert.match(formatMoney(12.5,{currency:'PEN'}),/12[.,]50/);assert.match(formatMoney(1000,{currency:'CLP'}),/1[.,]000/);
});

test('Cantidades decimales: permite consumir el stock exacto sin residuos negativos',()=>{
 const p=[{id:'p',name:'Producto',stock:0,recipe:[{insumoId:'i',qty:0.1}]}];
 const i=[{id:'i',name:'Ingrediente',stock:0.3}];
 const result=productionInventory(p,i,'p',3,10);
 assert.equal(result.products[0].stock,3);assert.equal(result.insumos[0].stock,0);
 assert.throws(()=>productionInventory(p,[{...i[0],stock:0.29}],'p',3,10),/alcanza/);
 const sale=saleInventory([{id:'p',name:'Producto',stock:0.3}],[{productId:'p',qty:0.1},{productId:'p',qty:0.2}],{automatic:true});
 assert.equal(sale.products[0].stock,0);
});
