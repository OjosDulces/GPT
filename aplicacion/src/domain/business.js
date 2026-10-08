export const DEFAULT_PROFILE = Object.freeze({ name: 'Mi negocio', tagline: 'Cada día, con más claridad', industry: 'comercio', currency: 'CLP', locale: 'es-CL', countryCode: '56', inventoryMode: 'manual', timezone:'America/Santiago' });
export const CURRENCIES = {
 CLP:{locale:'es-CL',label:'Peso chileno · CLP',digits:0,countryCode:'56'},
 PEN:{locale:'es-PE',label:'Sol peruano · PEN',digits:2,countryCode:'51'},
 USD:{locale:'es-US',label:'Dólar estadounidense · USD',digits:2,countryCode:'1'},
 MXN:{locale:'es-MX',label:'Peso mexicano · MXN',digits:2,countryCode:'52'},
 COP:{locale:'es-CO',label:'Peso colombiano · COP',digits:2,countryCode:'57'},
 ARS:{locale:'es-AR',label:'Peso argentino · ARS',digits:2,countryCode:'54'},
};
let current = { ...DEFAULT_PROFILE };
export function setBusinessProfile(profile = {}) {
  const currency = CURRENCIES[profile.currency] ? profile.currency : 'CLP';
  current = { ...DEFAULT_PROFILE, ...profile, currency, locale: CURRENCIES[currency].locale };
  return current;
}
export const getBusinessProfile = () => current;
export function formatMoney(value, profile = current) {
  const currency = CURRENCIES[profile.currency] ? profile.currency : 'CLP';
  return new Intl.NumberFormat(CURRENCIES[currency].locale, { style: 'currency', currency, minimumFractionDigits: CURRENCIES[currency].digits, maximumFractionDigits: CURRENCIES[currency].digits }).format(Number(value) || 0);
}
export function scopedKey(key) {
  const workspace = globalThis.window?.businessContext;
  return `${key}:${workspace?.userId || 'local'}:${workspace?.id || 'none'}`;
}
export function validateProfile(profile) {
  if (typeof profile.name !== 'string' || profile.name.trim().length < 2 || profile.name.trim().length > 100) throw new Error('El nombre debe tener entre 2 y 100 caracteres.');
  if (!CURRENCIES[profile.currency]) throw new Error('Selecciona una moneda válida.');
  if (!['manual', 'automatic'].includes(profile.inventoryMode)) throw new Error('Selecciona el control de stock.');
  if (!/^\d{1,4}$/.test(profile.countryCode)) throw new Error('Revisa el código de país.');
  return { ...profile, name: profile.name.trim(), tagline: String(profile.tagline || '').slice(0, 160), locale: CURRENCIES[profile.currency].locale };
}
