import { finiteNumber, newId, roundMoney } from './data.js';
const quantityTolerance = (a,b) => Number.EPSILON * Math.max(1,Math.abs(a),Math.abs(b)) * 8;
const subtractQuantity = (a,b) => Math.abs(a-b)<=quantityTolerance(a,b) ? 0 : a-b;

export function saleInventory(products, items, { automatic = false, reverse = false, referenceId, dateISO = new Date().toISOString() } = {}) {
  if (!automatic) return { products, movements: [] };
  const quantities = new Map();
  for (const item of items) {
    const qty = finiteNumber(item.qty, 'Cantidad', { positive: true });
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + qty);
  }
  for (const id of quantities.keys()) if (!products.some(p => p.id === id)) throw new Error('Un producto ya no existe. Actualiza el catálogo.');
  const movements = [];
  const next = products.map(product => {
    const qty = quantities.get(product.id);
    if (!qty || product.trackStock === false) return product;
    const delta = reverse ? qty : -qty;
    const stock = reverse ? Number(product.stock || 0) + qty : subtractQuantity(Number(product.stock || 0),qty);
    if (stock < 0) throw new Error(`Stock insuficiente de ${product.name}. Disponible: ${product.stock || 0}.`);
    movements.push({ id: newId('mov'), dateISO, type: reverse ? 'Reverso de venta' : 'Salida por venta', entityType: 'producto', entityId: product.id, name: product.name, qty: delta, unit: 'unid', referenceId, note: reverse ? 'Venta anulada' : 'Stock reservado al registrar la venta' });
    return { ...product, stock };
  });
  return { products: next, movements };
}

export function purchaseInventory(insumos, lines, referenceId, dateISO) {
  const next = structuredClone(insumos);
  const movements = [];
  for (const line of lines) {
    const item = next.find(i => i.id === line.insumoId);
    if (!item) throw new Error('Uno de los insumos ya no existe.');
    const qty = finiteNumber(line.qty, 'Cantidad de compra', { positive: true });
    const total = finiteNumber(line.totalPrice ?? qty * Number(line.unitCost), 'Costo de compra', { positive: true });
    const cost = total / qty;
    const oldStock = Number(item.stock || 0);
    item.costPerUnit = oldStock > 0 && ['purchase', 'manual', 'initial'].includes(item.costSource) ? (oldStock * Number(item.costPerUnit || 0) + total) / (oldStock + qty) : cost;
    item.stock = oldStock + qty;
    item.costSource = 'purchase'; item.lastPurchaseAt = dateISO; item.lastPurchaseUnitCost = cost;
    movements.push({ id: newId('mov'), dateISO, type: 'Entrada por compra', entityType: 'insumo', entityId: item.id, name: item.name, qty, unit: item.unit, referenceId, note: 'Compra de insumos' });
  }
  return { insumos: next, movements };
}

export function productionInventory(products, insumos, productId, quantity, unitCost) {
  const qty = finiteNumber(quantity, 'Cantidad a producir', { positive: true });
  const product = products.find(p => p.id === productId);
  if (!product) throw new Error('El producto ya no existe.');
  const requirements = new Map();
  for (const line of product.recipe || []) requirements.set(line.insumoId, (requirements.get(line.insumoId) || 0) + finiteNumber(line.qty, 'Receta', { positive: true }) * qty);
  for (const [id, required] of requirements) {
    const item = insumos.find(i => i.id === id);
    if (!item || subtractQuantity(Number(item.stock || 0),required) < 0) throw new Error(`No alcanza ${item?.name || 'un insumo eliminado'} para producir.`);
  }
  const dateISO = new Date().toISOString();
  const production = { id: newId('prodlog'), dateISO, productId, productName: product.name, qty, unitCost, totalCost: roundMoney(unitCost * qty) };
  return {
    production,
    products: products.map(p => p.id === productId ? { ...p, stock: Number(p.stock || 0) + qty } : p),
    insumos: insumos.map(i => requirements.has(i.id) ? { ...i, stock: subtractQuantity(Number(i.stock || 0),requirements.get(i.id)) } : i),
    movements: [{ id: newId('mov'), dateISO, type: 'Entrada por producción', entityType: 'producto', entityId: productId, name: product.name, qty, unit: 'unid', referenceId: production.id }, ...[...requirements].map(([id, amount]) => ({ id: newId('mov'), dateISO, type: 'Consumo en producción', entityType: 'insumo', entityId: id, name: insumos.find(i => i.id === id).name, qty: -amount, unit: insumos.find(i => i.id === id).unit, referenceId: production.id }))],
  };
}

export function cashEntries(sale) {
  if (Array.isArray(sale.payments)) return sale.payments;
  // No se inventa la fecha de cobros anteriores a esta versión.
  return [];
}
export const localDay = value => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export function financialSummary(sales, expenses, { from, to }) {
  const within = date => date && localDay(date) >= from && localDay(date) <= to;
  const periodSales = sales.filter(s => within(s.dateISO));
  const billed = periodSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const collected = sales.flatMap(cashEntries).filter(p => within(p.dateISO)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paidExpenses = expenses.filter(e => e.paymentStatus === 'Pagado' && within(e.paidAt || e.dateISO)).reduce((sum, e) => sum + Number(e.total || 0), 0);
  return { billed, collected, paidExpenses, cashFlow: collected - paidExpenses, receivables: sales.reduce((sum, s) => sum + Math.max(0, Number(s.total || 0) - Number(s.paidAmount || 0)), 0), payables: expenses.filter(e => e.paymentStatus !== 'Pagado').reduce((sum, e) => sum + Number(e.total || 0), 0), grossMargin: billed - periodSales.reduce((sum, s) => sum + Number(s.cost || 0), 0), undatedCollections: sales.reduce((sum, s) => sum + Number(Array.isArray(s.payments) ? (s.legacyPaidAmount || 0) : (s.paidAmount || 0)), 0) };
}
