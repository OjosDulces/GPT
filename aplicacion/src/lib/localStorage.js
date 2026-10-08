import {emptyData, KEY_TO_COLUMN, validateCollection} from '../domain/data.js';
import {DEFAULT_PROFILE} from '../domain/business.js';

// Own business data has a separate database from every old demonstration.
// Never replace unreadable data with a new, empty business.
export const LOCAL_DATABASE = 'control-emprende-local-v1';
const STORE = 'business';
const KEY = 'primary';
const problem = (message, code) => Object.assign(new Error(message), {code});
function initialData() {
  return {...emptyData(), profile:{...DEFAULT_PROFILE, onboardingComplete:false,
    monthlyGoal:0, leadTimeDays:7}, version:0, updated_at:new Date().toISOString()};
}
function validateSnapshot(data) {
  if (!data || !Number.isSafeInteger(data.version) || data.version < 0)
    throw problem('No pudimos leer los datos guardados. No se han reemplazado ni borrado.', 'CORRUPT');
  for (const key of Object.keys(emptyData())) validateCollection(key, data[key]);
  return data;
}
export function createLocalStorage({database=LOCAL_DATABASE, indexedDB=globalThis.indexedDB, authorizeWrite}={}) {
  let connection, disposed=false, snapshot=null;
  async function connect() {
    if (disposed) throw problem('El negocio se cerró. Vuelve a abrir la aplicación.', 'SESSION');
    if (!indexedDB) throw problem('El almacenamiento del equipo no está disponible.', 'STORAGE');
    if (!connection) connection = new Promise((resolve,reject)=>{
      const request=indexedDB.open(database,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
      request.onerror=()=>reject(problem('No pudimos abrir los datos del equipo. Revisa el espacio disponible y vuelve a intentarlo.', 'STORAGE'));
      request.onblocked=()=>reject(problem('Cierra las otras ventanas de Control Emprende y vuelve a abrir la aplicación.', 'BLOCKED'));
      request.onsuccess=()=>{
        const db=request.result;
        if(disposed){db.close();reject(problem('El negocio se cerró.', 'SESSION'));return;}
        db.onversionchange=()=>{db.close();connection=null;};
        resolve(db);
      };
    }).catch(error=>{connection=null;throw error;});
    return connection;
  }
  async function access(change) {
    const db=await connect();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
      let result,failure;
      tx.oncomplete=()=>{snapshot=result;resolve(structuredClone(result));};
      tx.onabort=()=>reject(failure||problem('No se guardaron los cambios. Revisa el espacio disponible en el equipo e inténtalo de nuevo.', 'STORAGE'));
      const request=store.get(KEY);
      request.onsuccess=()=>{
        try{
          const fresh=request.result===undefined;
          const current=fresh?initialData():validateSnapshot(request.result);
          result=change?change(current):current;
          if(change||fresh)store.put(result,KEY);
        }catch(error){failure=error;tx.abort();}
      };
    });
  }
  return {
    getSnapshot:()=>access(),
    refresh:()=>access(),
    async get(key){const column=KEY_TO_COLUMN[key];if(!column)throw Error('Clave desconocida.');const data=await access();return {value:JSON.stringify(data[column])};},
    async setMany(patch,{expectedVersion=snapshot?.version}={}) {
      if(authorizeWrite){const permission=await authorizeWrite();if(!permission?.canWrite)throw problem(permission?.error||permission?.reason||'Tu licencia está en modo de solo lectura.', 'LICENSE');}
      if(!Number.isSafeInteger(expectedVersion))throw problem('Carga el negocio antes de guardar.', 'VERSION');
      const changes=structuredClone(patch);
      for(const [key,value] of Object.entries(changes)){
        if(!Object.values(KEY_TO_COLUMN).includes(key))throw problem('Campo de datos desconocido.', 'VALIDATION');
        validateCollection(key,value);
      }
      return access(current=>{
        if(current.version!==expectedVersion)throw problem('Los datos cambiaron en otra ventana. Actualiza antes de guardar; tus cambios no se han aplicado.', 'CONFLICT');
        return {...current,...changes,version:current.version+1,updated_at:new Date().toISOString()};
      });
    },
    async set(key,value){const column=KEY_TO_COLUMN[key];if(!column)throw Error('Clave desconocida.');return this.setMany({[column]:JSON.parse(value)});},
    invalidate(){},
    dispose(){disposed=true;connection?.then(db=>db.close()).catch(()=>{});}
  };
}
