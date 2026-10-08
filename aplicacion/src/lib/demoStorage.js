import { emptyData, KEY_TO_COLUMN, validateCollection } from '../domain/data.js';
import { localDay } from '../domain/operations.js';

export const DEMO_BUSINESSES = [
  { id: 'demo-dulceria', name: 'Dulcería Aurora', industry: 'alimentos', currency: 'CLP', countryCode: '56', tagline: 'Pequeños detalles, grandes momentos', inventoryMode: 'automatic' },
  { id: 'demo-tienda', name: 'Estudio Papel', industry: 'comercio', currency: 'PEN', countryCode: '51', tagline: 'Ideas que toman forma', inventoryMode: 'automatic' },
  { id: 'demo-nuevo', name: 'Mi nuevo negocio', industry: 'comercio', currency: 'CLP', countryCode: '56', inventoryMode: 'automatic', empty: true },
  { id: 'demo-servicios', name: 'Taller Creativo', industry: 'servicios', currency: 'USD', countryCode: '1', tagline: 'Tu próxima idea empieza aquí', inventoryMode: 'manual' },
];
function seed(profile) {
  const date = offset => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(12, 0, 0, 0); return d.toISOString(); };
  const data = emptyData();
  data.profile = {...profile, onboardingComplete: !profile.empty, timezone:profile.currency==='PEN'?'America/Lima':'America/Santiago', monthlyGoal: profile.currency==='CLP'?350000:2000, leadTimeDays:7};
  if (profile.empty) return {...data,version:0,updated_at:date(0)};
  const names = profile.industry === 'alimentos' ? ['Caja de alfajores', 'Cuchuflí artesanal', 'Pack de regalo', 'Galletas de avena'] : profile.industry === 'comercio' ? ['Cuaderno artesanal', 'Set de lápices', 'Agenda semanal', 'Tarjeta de regalo'] : ['Sesión de diseño', 'Identidad visual', 'Asesoría de marca', 'Diseño para redes'];
  const prices = profile.currency === 'CLP' ? [6500, 1200, 14500, 3500] : profile.currency === 'PEN' ? [35, 18, 49, 12] : [75, 450, 90, 40];
  data.products = names.map((name, i) => ({ id: `demo-prod-${i}`, name, category: profile.industry === 'servicios' ? 'Servicios' : i === 2 ? 'Especiales' : 'Más vendidos', price: prices[i], stock: [28, 60, 3, 18][i], minStock: 5, active: true, trackStock: profile.industry !== 'servicios', recipe: [], laborCost: prices[i] * .15, otherCost: prices[i] * .2, costing: { enabled: false, recipe: [], yieldQty: 1 } }));
  data.insumos = [{ id: 'demo-insumo-1', name: 'Material de embalaje', unit: 'unid', stock: 45, minStock: 10, costPerUnit: prices[1] * .12, costSource: 'manual', active: true }];
  data.customers = ['María Soto', 'Diego Rojas', 'Lucía Torres'].map((name, i) => ({ id: `demo-cli-${i}`, name, phone: '', notes: 'Cliente ficticio de demostración', createdAt: date(-20) }));
  data.sales = Array.from({ length: 12 }, (_, i) => {
    const product = data.products[i % 4], customer = data.customers[i % 3], qty = i % 3 + 1, total = qty * product.price, paidAmount = i < 3 ? Math.round(total / 2) : total, dateISO = date(-Math.floor(i * 2.7));
    return { id: `demo-venta-${i}`, dateISO, customerId: customer.id, customerName: customer.name, items: [{ productId: product.id, name: product.name, qty, price: product.price, unitCost: product.price * .35 }], subtotal: total, total, discount: 0, delivery: 0, cost: total * .35, costKnown:true, paymentDueDate:i<2?localDay(date(-2)):'', paidAmount, payments: [{ id: `demo-pago-${i}`, dateISO, amount: paidAmount, method: 'Transferencia' }], balance: total - paidAmount, paymentStatus: paidAmount === total ? 'Pagado' : 'Parcial', paymentMethod: 'Transferencia', orderStatus: i < 4 ? ['Pendiente', 'En preparación', 'Listo', 'Pendiente'][i] : 'Entregado', deliveryDate: localDay(date(i === 3 ? -1 : i < 2 ? 0 : 1)), deliveryTime: '16:00', stockControlApplied: false, notes: 'Registro ficticio' };
  });
  data.expenses = [{ id: 'demo-gasto-1', dateISO: date(-2), paidAt: date(-2), type: 'Gasto', category: 'Servicios', description: 'Internet del local', total: prices[0] * 2, paymentStatus: 'Pagado', paymentMethod: 'Transferencia', items: [] }];
  return { ...data, version: 0, updated_at: date(0) };
}
export function createDemoStorage(profile) {
  const key = `control-emprende-demo-v4:${profile.id}`;
  const read = () => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : seed(profile); };
  let snapshot = read();
  return {
    async getSnapshot() { snapshot = read(); return structuredClone(snapshot); },
    async refresh() { return this.getSnapshot(); },
    async get(key) { const data = await this.getSnapshot(); const value = data[KEY_TO_COLUMN[key]]; return value == null ? null : { value: JSON.stringify(value) }; },
    async setMany(patch, { expectedVersion = snapshot.version } = {}) {
      const current = read();
      if (current.version !== expectedVersion) throw Object.assign(new Error('La demostración cambió en otra pestaña. Actualiza los datos.'), { code: 'CONFLICT' });
      Object.entries(patch).forEach(([key, value]) => validateCollection(key, value));
      const next = { ...current, ...structuredClone(patch), version: current.version + 1, updated_at: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(next)); snapshot = next; return structuredClone(next);
    },
    async set(key, value) { return this.setMany({ [KEY_TO_COLUMN[key]]: JSON.parse(value) }); },
    invalidate() {}, dispose() {},
    reset() { localStorage.removeItem(key); },
  };
}
