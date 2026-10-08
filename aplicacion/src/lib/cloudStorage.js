import { KEY_TO_COLUMN, validateCollection } from '../domain/data.js';

const columns = [...Object.values(KEY_TO_COLUMN), 'version', 'updated_at'].join(',');
export class StorageError extends Error {
  constructor(message, code) { super(message); this.name = 'StorageError'; this.code = code; }
}
export function createCloudStorage({ supabase, businessId, userId, role = 'member', cache = globalThis.localStorage, online = () => globalThis.navigator?.onLine !== false, onStatus = () => {} }) {
  const cacheKey = `control-emprende:v3:${userId}:${businessId}`;
  let snapshot = null, inFlight = null, busy = false, disposed = false, lastFetch = 0, uncertain = false;
  const emit = (state, detail = '') => { onStatus({ state, detail }); };
  function remember(data) { try { cache?.setItem(cacheKey, JSON.stringify(data)); } catch { /* Online data remains authoritative. */ } }
  function offlineSnapshot() {
    try { const data = snapshot || JSON.parse(cache?.getItem(cacheKey) || 'null'); if (data) { emit('offline', 'Última copia consultada. Solo lectura.'); return data; } } catch { /* Missing or damaged cache. */ }
    throw new StorageError('No hay una copia disponible. Conéctate para abrir el negocio.', 'OFFLINE');
  }
  async function getSnapshot(force = false) {
    if (disposed) throw new StorageError('La sesión cambió. Vuelve a abrir el negocio.', 'SESSION');
    if (!online()) return offlineSnapshot();
    if (inFlight) return inFlight;
    if (!force && snapshot && Date.now() - lastFetch < 1500) return snapshot;
    inFlight = (async () => {
      try {
        const { data, error } = await supabase.from('business_data').select(columns).eq('business_id', businessId).single();
        if (error) throw error;
        if (!data || !Number.isSafeInteger(Number(data.version))) throw new StorageError('Actualiza la base de datos con la migración 003 antes de usar esta versión.', 'SCHEMA');
        if (disposed) throw new StorageError('La sesión cambió.', 'SESSION');
        snapshot = data; lastFetch = Date.now(); uncertain = false; remember(data); emit('ready'); return data;
      } catch (error) {
        // Never substitute cached personal data after a permission failure or missing row.
        if (!online() || (error instanceof TypeError && /fetch|network/i.test(error.message))) return offlineSnapshot();
        if (['PGRST116', '42501', '401', '403'].includes(String(error.code))) { snapshot = null; cache?.removeItem(cacheKey); }
        emit('error', error.message);
        throw new StorageError(error.code === '42703' ? 'Falta aplicar la migración 003 de esta versión.' : (error.message || 'No fue posible consultar los datos.'), error.code || 'READ');
      } finally { inFlight = null; }
    })();
    return inFlight;
  }
  async function setMany(patch, { expectedVersion = snapshot?.version, action = 'edit', operationId = crypto.randomUUID() } = {}) {
    if (disposed) throw new StorageError('La sesión cambió.', 'SESSION');
    if (role === 'reader') throw new StorageError('Tu acceso es de solo lectura.', 'FORBIDDEN');
    if (!online()) throw new StorageError('Sin conexión. Los cambios no se guardaron.', 'OFFLINE');
    if (busy) throw new StorageError('Espera a que termine el guardado actual.', 'BUSY');
    if (uncertain) throw new StorageError('Actualiza los datos y revisa el último registro antes de volver a guardar.', 'UNCERTAIN');
    if (!Number.isSafeInteger(Number(expectedVersion)) || expectedVersion === undefined) throw new StorageError('Carga los datos antes de guardar.', 'VERSION');
    for (const [key, value] of Object.entries(patch)) {
      if (!Object.values(KEY_TO_COLUMN).includes(key)) throw new StorageError('Campo de datos desconocido.', 'VALIDATION');
      validateCollection(key, value);
    }
    busy = true; emit('saving');
    try {
      const { data, error } = await supabase.rpc('commit_business_data', { p_business_id: businessId, p_expected_version: Number(expectedVersion), p_patch: patch, p_operation_id: operationId, p_action: action });
      if (error) throw error;
      if (!data || data.version === undefined) throw new StorageError('No se pudo confirmar el guardado. Actualiza y revisa el registro.', 'UNCERTAIN');
      if (disposed) throw new StorageError('La sesión cambió durante el guardado.', 'SESSION');
      snapshot = data; lastFetch = Date.now(); remember(data); emit('ready'); return data;
    } catch (error) {
      if (error.code === '40001') {
        lastFetch = 0; emit('conflict');
        throw new StorageError('Otra persona modificó este negocio. Actualiza los datos antes de reintentar; tus cambios no se guardaron.', 'CONFLICT');
      }
      if (error.code === 'PGRST202') throw new StorageError('Falta aplicar la migración 003. No se guardó ningún cambio.', 'SCHEMA');
      uncertain = !error.code || error.code === 'UNCERTAIN';
      emit('error', error.message);
      throw new StorageError(uncertain ? 'No se pudo confirmar el guardado. Actualiza y revisa el registro antes de repetir.' : (error.message || 'No fue posible guardar.'), uncertain ? 'UNCERTAIN' : error.code);
    } finally { busy = false; }
  }
  return {
    getSnapshot, setMany,
    async get(key) { const column = KEY_TO_COLUMN[key]; if (!column) throw new Error('Clave desconocida.'); const data = await getSnapshot(); return data[column] == null ? null : { value: JSON.stringify(data[column]) }; },
    async set(key, value) { const column = KEY_TO_COLUMN[key]; if (!column) throw new Error('Clave desconocida.'); return setMany({ [column]: JSON.parse(value) }); },
    invalidate() { lastFetch = 0; },
    refresh: () => getSnapshot(true),
    dispose({ clearCache = false } = {}) { disposed = true; snapshot = null; if (clearCache) cache?.removeItem(cacheKey); },
  };
}
