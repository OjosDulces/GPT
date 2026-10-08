export const KEY_TO_COLUMN = Object.freeze({ products: 'products', insumos: 'insumos', customers: 'customers', sales: 'sales', quotes_v2: 'quotes', expenses_v2: 'expenses', suppliers_v2: 'suppliers', productions_v2: 'productions', inventory_movements_v2: 'movements', budgets_v2: 'budgets', profile_v3: 'profile' });
export const COLLECTIONS = ['products', 'insumos', 'customers', 'sales', 'quotes', 'expenses', 'suppliers', 'productions', 'movements'];
export const emptyData = () => Object.fromEntries([...COLLECTIONS.map(key => [key, []]), ['budgets', {}], ['profile', {}]]);
export const newId = (prefix = 'id') => `${prefix}_${crypto.randomUUID()}`;
export const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function finiteNumber(value, label, { min = 0, positive = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || (positive && n <= 0)) throw new Error(`${label}: ingresa un número ${positive ? 'mayor que cero' : 'válido'}.`);
  return n;
}
export function validateCollection(key, value) {
  if (!COLLECTIONS.includes(key)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key}: formato inválido.`);
    return;
  }
  if (!Array.isArray(value)) throw new Error(`${key}: debe ser una lista.`);
  const ids = new Set();
  for (const row of value) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) throw new Error(`${key}: hay registros sin identificador o duplicados.`);
    ids.add(row.id);
    for (const field of ['stock', 'minStock', 'price', 'total', 'paidAmount', 'costPerUnit']) {
      if (row[field] !== undefined) finiteNumber(row[field], `${key} · ${field}`);
    }
    if (['sales', 'quotes'].includes(key)) {
      if (!Array.isArray(row.items) || !row.items.length) throw new Error(`${key}: hay un registro sin detalle.`);
      for (const item of row.items) {
        finiteNumber(item.qty, 'Cantidad', { positive: true });
        finiteNumber(item.price, 'Precio');
      }
      if (row.paidAmount > row.total) throw new Error('El pago no puede superar el total.');
    }
  }
}
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('Respaldo inválido.');
  if (parsed.version !== undefined && ![1, 2, 3].includes(parsed.version)) throw new Error('Versión de respaldo no compatible.');
  const data = parsed.data || parsed;
  const required = parsed.version === 3 ? COLLECTIONS : ['products', 'insumos', 'customers', 'sales'];
  if (required.some(key => !Array.isArray(data[key]))) throw new Error('El respaldo está incompleto.');
  const result = emptyData();
  for (const key of Object.keys(result)) {
    result[key] = data[key] ?? result[key];
    validateCollection(key, result[key]);
  }
  return result;
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
