import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  Clipboard,
  Cloud,
  CloudOff,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
  WifiOff,
} from "lucide-react";
const BusinessApp = lazy(() => import('./BusinessApp.jsx'));
const LocalWorkspace = lazy(() => import('./components/LocalWorkspace.jsx'));
const PublicCatalog = lazy(() => import('./components/PublicCatalog.jsx'));
import { createDemoStorage, DEMO_BUSINESSES } from './lib/demoStorage.js';
import { AccessibleDialog } from './components/WorkspaceFeatures.jsx';
import { createCloudStorage } from "./lib/cloudStorage.js";
import Landing from './components/Landing.jsx';
import { PlatformAdmin } from './components/BillingAdmin.jsx';
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
const logo = '/favicon.svg';

function ShellCard({ children, className = "" }) {
  return <div className={`rounded-3xl border border-oro/20 bg-white shadow-xl shadow-choco/10 ${className}`}>{children}</div>;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src={logo} alt="Control Emprende" className="h-14 w-14 rounded-full object-cover shadow-lg shadow-choco/20" />
      <div>
        <h1 className="font-brand text-2xl font-semibold tracking-tight text-choco">Control Emprende</h1>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-caramelo">Más control. Más tiempo para crecer.</p>
      </div>
    </div>
  );
}

function ConfigurationMissing() {
  return <div className="min-h-screen bg-crema px-4 py-16"><div className="mx-auto max-w-lg"><Brand/><ShellCard className="mt-8 p-8"><span className="ce-eyebrow">CONTROL EMPRENDE</span><h2 className="text-2xl font-bold mt-3">Las cuentas todavía no están habilitadas</h2><p className="ce-description mt-4">Puedes conocer la aplicación y probar sus funciones con datos de ejemplo, sin registrarte.</p><a href="/?demo=1" className="ce-button mt-5">Explorar la demo</a><a href="/" className="ce-text-button mt-4">Volver al inicio</a></ShellCard></div></div>;
}

function AuthScreen() {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setMessage(null);

    if (mode === "reset") {
      if (!email.trim()) { setMessage({ tone: "red", text: "Ingresa tu correo electrónico." }); return; }
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/app" });
      setLoading(false);
      if (error) setMessage({ tone: "red", text: error.message });
      else setMessage({ tone: "emerald", text: "Listo. Revisa tu correo y sigue el link para elegir una nueva contraseña." });
      return;
    }

    if (!email.trim() || password.length < (mode === "signup" ? 10 : 6)) {
      setMessage({ tone: "red", text: "Ingresa un correo válido y una contraseña de al menos 10 caracteres al crear una cuenta." });
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({ tone: "emerald", text: "Cuenta creada. Revisa tu correo y confirma el acceso antes de iniciar sesión." });
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage({ tone: "red", text: error.message || "No fue posible completar el acceso." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-crema px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center sm:justify-start">
          <Brand />
        </div>
        <ShellCard className="p-6 sm:p-8">
          {mode !== "reset" && <div className="mb-6 grid grid-cols-2 rounded-xl bg-crema p-1 text-sm">
            <button type="button" onClick={() => { setMode("login"); setMessage(null); }} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "login" ? "bg-white text-choco shadow-sm" : "text-choco/50"}`}>Ingresar</button>
            <button type="button" onClick={() => { setMode("signup"); setMessage(null); }} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "signup" ? "bg-white text-choco shadow-sm" : "text-choco/50"}`}>Crear cuenta</button>
          </div>}

          {mode === "reset" && <div className="mb-5"><h2 className="font-brand text-lg font-semibold text-choco">Recuperar contraseña</h2><p className="text-sm text-choco/60 mt-1">Te enviaremos un link a tu correo para elegir una nueva.</p></div>}

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-choco/60">Correo electrónico</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-caramelo" size={17} />
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.cl" className="w-full rounded-xl border border-oro/30 py-3 pl-10 pr-3 text-sm outline-none focus:border-caramelo focus:ring-2 focus:ring-oro/20" />
              </div>
            </label>
            {mode !== "reset" && <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-choco/60">Contraseña</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-caramelo" size={17} />
                <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" className="w-full rounded-xl border border-oro/30 py-3 pl-10 pr-3 text-sm outline-none focus:border-caramelo focus:ring-2 focus:ring-oro/20" />
              </div>
              {mode === "login" && <button type="button" onClick={() => { setMode("reset"); setMessage(null); }} className="mt-1.5 text-xs font-medium text-caramelo hover:underline">¿Olvidaste tu contraseña?</button>}
            </label>}

            {message && <div className={`rounded-xl px-3 py-2.5 text-sm ${message.tone === "red" ? "bg-rosa/15 text-choco" : "bg-oro/15 text-choco"}`}>{message.text}</div>}

            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-choco px-4 py-3 font-semibold text-crema hover:bg-choco-dark disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={18} /> : mode === "signup" ? <UserPlus size={18} /> : mode === "reset" ? <Mail size={18} /> : <LogIn size={18} />}
              {mode === "signup" ? "Crear mi cuenta" : mode === "reset" ? "Enviar link de recuperación" : "Ingresar"}
            </button>
            {mode === "reset" && <button type="button" onClick={() => { setMode("login"); setMessage(null); }} className="w-full text-center text-xs font-medium text-choco/60 hover:underline">← Volver a ingresar</button>}
          </form>

          <a href="/?demo=1" className="ce-demo-link">Probar con datos de ejemplo →</a>
          {mode !== "reset" && <div className="mt-6 grid grid-cols-3 gap-2 border-t border-oro/15 pt-5 text-center text-[11px] text-choco/60">
            <div><ShieldCheck className="mx-auto mb-1 text-caramelo" size={17} />Acceso protegido</div>
            <div><Cloud className="mx-auto mb-1 text-caramelo" size={17} />Datos en línea</div>
            <div><Smartphone className="mx-auto mb-1 text-caramelo" size={17} />Instalable</div>
          </div>}
        </ShellCard>
      </div>
    </div>
  );
}

function SetNewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (password.length < 10) { setMessage({ tone: "red", text: "La contraseña debe tener al menos 10 caracteres." }); return; }
    if (password !== confirm) { setMessage({ tone: "red", text: "Las contraseñas no coinciden." }); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setMessage({ tone: "red", text: error.message }); return; }
    onDone();
  }

  return (
    <div className="min-h-screen bg-crema px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center sm:justify-start"><Brand /></div>
        <ShellCard className="p-6 sm:p-8">
          <h2 className="font-brand text-xl font-semibold text-choco mb-1">Elige tu nueva contraseña</h2>
          <p className="text-sm text-choco/60 mb-5">Escríbela dos veces para confirmarla.</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-choco/60">Nueva contraseña</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-caramelo" size={17} />
                <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" className="w-full rounded-xl border border-oro/30 py-3 pl-10 pr-3 text-sm outline-none focus:border-caramelo focus:ring-2 focus:ring-oro/20" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-choco/60">Repite la contraseña</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-caramelo" size={17} />
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" className="w-full rounded-xl border border-oro/30 py-3 pl-10 pr-3 text-sm outline-none focus:border-caramelo focus:ring-2 focus:ring-oro/20" />
              </div>
            </label>
            {message && <div className="rounded-xl bg-rosa/15 px-3 py-2.5 text-sm text-choco">{message.text}</div>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-choco px-4 py-3 font-semibold text-crema hover:bg-choco-dark transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Guardar contraseña
            </button>
          </form>
        </ShellCard>
      </div>
    </div>
  );
}

function BusinessSetup({ onReady, initialCode = "", onCancel }) {
  const [section, setSection] = useState(initialCode ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createBusiness(event) {
    event.preventDefault();
    if (name.trim().length < 2) return;
    setLoading(true);
    setError("");
    try { const { data, error: rpcError } = await supabase.rpc("create_business", { p_name: name.trim() });
    if (rpcError) setError(rpcError.message);
    else await onReady(data?.[0]?.business_id); } catch (error) { setError(error.message); }
    setLoading(false);
  }

  async function joinBusiness(event) {
    event.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try { const { data, error: rpcError } = await supabase.rpc("join_business_by_code", { p_code: code.trim().toUpperCase() });
    if (rpcError) setError(rpcError.message);
    else await onReady(data); } catch (error) { setError(error.message); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-crema px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex justify-center sm:justify-start"><Brand /></div>
        <ShellCard className="mt-8 overflow-hidden">
          <div className="border-b border-oro/15 p-6 sm:p-8">
            <h2 className="font-brand text-2xl font-semibold text-choco">Conecta tu cuenta a un negocio</h2>
            <p className="mt-2 text-sm leading-6 text-choco/60">Crea un espacio para tu emprendimiento o únete al equipo con una invitación. Puedes gestionar varios negocios con una misma cuenta.</p>
          </div>
          <div className="grid sm:grid-cols-2">
            <button onClick={() => { setSection("create"); setError(""); }} className={`border-b p-5 text-left sm:border-b-0 sm:border-r border-oro/15 ${section === "create" ? "bg-rosa/15" : "bg-white"}`}>
              <Building2 className="mb-2 text-caramelo" size={22} />
              <p className="font-semibold text-choco">Crear un negocio</p>
              <p className="mt-1 text-xs text-choco/60">Para quien configura la aplicación primero.</p>
            </button>
            <button onClick={() => { setSection("join"); setError(""); }} className={`p-5 text-left ${section === "join" ? "bg-rosa/15" : "bg-white"}`}>
              <Users className="mb-2 text-caramelo" size={22} />
              <p className="font-semibold text-choco">Unirme con un código</p>
              <p className="mt-1 text-xs text-choco/60">Para las personas de tu equipo.</p>
            </button>
          </div>
          <div className="border-t border-oro/15 p-6 sm:p-8">
            {section === "create" ? (
              <form onSubmit={createBusiness} className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-choco/60">Nombre del negocio</span><input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required placeholder="Ej: Mi taller" className="w-full rounded-xl border border-oro/30 px-3 py-3 text-sm outline-none focus:border-caramelo focus:ring-2 focus:ring-oro/20" /></label>
                <button disabled={loading || name.trim().length < 2} className="flex w-full items-center justify-center gap-2 rounded-xl bg-choco py-3 font-semibold text-crema hover:bg-choco-dark disabled:opacity-40">{loading ? <Loader2 className="animate-spin" size={18} /> : <Building2 size={18} />} Crear negocio compartido</button>
              </form>
            ) : (
              <form onSubmit={joinBusiness} className="space-y-4">
                {initialCode && <p className="rounded-lg bg-oro/15 px-3 py-2 text-xs text-choco">Detectamos tu código de invitación. Solo confirma tu correo y presiona "Unirme al negocio".</p>}
                <label className="block"><span className="mb-1.5 block text-xs font-semibold text-choco/60">Código de invitación</span><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ej: A7K9P2XZ" className="w-full rounded-xl border border-oro/30 px-3 py-3 text-center font-mono text-lg tracking-[0.18em] uppercase outline-none focus:border-caramelo focus:ring-2 focus:ring-oro/20" /></label>
                <button disabled={loading || !code.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-choco py-3 font-semibold text-crema hover:bg-choco-dark disabled:opacity-40">{loading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />} Unirme al negocio</button>
              </form>
            )}
            {onCancel && <button className="mt-4 text-sm underline" onClick={onCancel}>Volver a mi negocio</button>}
            {error && <p className="mt-4 rounded-xl bg-rosa/15 px-3 py-2.5 text-sm text-choco">{error}</p>}
          </div>
        </ShellCard>
      </div>
    </div>
  );
}

function WorkspaceBar({ business, memberships, membership, user, online, storageStatus, onSignOut, onSelect, onCreate, onTeam }) {
  const status = !online || storageStatus.state === 'offline' ? 'Sin conexión · consulta' : storageStatus.state === 'saving' ? 'Guardando…' : storageStatus.state === 'ready' ? 'Datos actualizados' : storageStatus.state === 'error' ? 'Revisar conexión' : 'Conectando…';
  return <div className="ce-workspace-top"><div className="ce-workspace-inner"><div className="ce-workspace-select"><Building2 size={18}/><label className="sr-only" htmlFor="workspace-selector">Negocio activo</label><select id="workspace-selector" value={business.id} onChange={e => onSelect(e.target.value)}>{memberships.map(m => <option key={m.business_id} value={m.business_id}>{m.businesses.name}</option>)}</select><span className="ce-workspace-role">{membership.role === 'owner' ? 'Propietario' : membership.role === 'reader' ? 'Consulta' : 'Editor'}</span></div><div className="ce-workspace-actions"><span className="ce-sync-state" role="status">{online ? <Cloud size={13}/> : <WifiOff size={13}/>} {status}</span><button onClick={onTeam} title="Equipo y actividad"><Users size={17}/><span>Equipo</span></button><button onClick={onCreate} title="Agregar otro negocio"><Building2 size={17}/><span>Agregar negocio</span></button><button onClick={onSignOut} title={`Cerrar sesión de ${user.email}`}><LogOut size={17}/></button></div></div></div>;
}

function TeamPanel({ business, role, onClose }) {
  const [members, setMembers] = useState([]), [audit, setAudit] = useState([]), [invite, setInvite] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [copied,setCopied] = useState(false);
  async function load() {
    try {
      const results = await Promise.all([supabase.rpc('list_business_team', { p_business_id: business.id }), supabase.from('business_audit').select('id,action,changed_keys,actor_id,created_at,version').eq('business_id',business.id).order('created_at',{ascending:false}).limit(15)]);
      for (const result of results) if(result.error) throw result.error;
      setMembers(results[0].data || []);setAudit(results[1].data || []);
      if(role === 'owner') { const result = await supabase.rpc('get_business_invite',{p_business_id:business.id});if(result.error) throw result.error;setInvite(result.data?.[0]); }
    } catch(e) {setError(e.message);}
  }
  useEffect(() => {load();}, []);
  async function mutate(userId, nextRole) {
    if(nextRole === 'remove' && !window.confirm('¿Retirar el acceso de esta persona al negocio?')) return;
    setBusy(true);setError('');
    try { const {error} = await supabase.rpc('set_business_member_role',{p_business_id:business.id,p_user_id:userId,p_role:nextRole});if(error)throw error;await load(); } catch(e){setError(e.message);} finally{setBusy(false);}
  }
  const actionLabels = {'sale.create':'Venta registrada','sale.delete':'Venta eliminada','payment.record':'Abono o corrección de pago','order.update':'Pedido actualizado','purchase.create':'Compra registrada','expense.create':'Gasto registrado','expense.delete':'Gasto eliminado','expense.pay':'Gasto pagado','production.create':'Producción registrada','inventory.adjust':'Ajuste de inventario','quote.save':'Cotización guardada','profile.update':'Configuración del negocio','backup.restore':'Respaldo restaurado','edit':'Registros actualizados'};
  return <AccessibleDialog title="Equipo y actividad" onClose={onClose}>{error && <p role="alert" className="ce-error">{error}</p>}<p className="ce-description">Cada persona utiliza su propia cuenta. El propietario administra los accesos.</p><div className="ce-team-list">{members.map(m => <div key={m.user_id}><span>{m.email}</span>{role === 'owner' && m.role !== 'owner' ? <select disabled={busy} aria-label={`Acceso de ${m.email}`} value={m.role} onChange={e=>mutate(m.user_id,e.target.value)}><option value="member">Puede editar</option><option value="reader">Solo consulta</option><option value="remove">Retirar acceso</option></select> : <strong>{m.role === 'owner' ? 'Propietario' : m.role === 'reader' ? 'Consulta' : 'Editor'}</strong>}</div>)}</div>{role==='owner' && invite && <section className="ce-invite"><h3>Invita a tu equipo</h3><p>La invitación permite editar. Después puedes cambiar el acceso a consulta.</p><p>Vence: {new Date(invite.expires_at).toLocaleString('es-CL')}</p><button className="ce-button" disabled={new Date(invite.expires_at) <= new Date()} onClick={async()=>{const link=`${window.location.origin}/?join=${invite.join_code}`;try{await navigator.clipboard.writeText(link);setCopied(true);}catch{window.prompt('Copia la invitación:',link);}}}>{copied?'Enlace copiado':'Copiar invitación'}</button><button disabled={busy} className="ce-text-button" onClick={async()=>{setBusy(true);try{const {error}=await supabase.rpc('rotate_business_code',{p_business_id:business.id});if(error)throw error;setCopied(false);await load();}catch(e){setError(e.message);}finally{setBusy(false);}}}>Renovar invitación por 7 días</button></section>}<h3 className="ce-panel-heading mt-5">Actividad reciente</h3><p className="ce-description">Cambios registrados desde esta versión.</p><div className="ce-audit-list">{audit.map(entry=><div key={entry.id}><strong>{actionLabels[entry.action] || 'Registros actualizados'}</strong><small>{members.find(m=>m.user_id===entry.actor_id)?.email || 'Integrante anterior'} · {new Date(entry.created_at).toLocaleString('es-CL')}</small></div>)}{!audit.length && <p className="ce-description">Todavía no hay cambios registrados.</p>}</div></AccessibleDialog>;
}

function FullScreenLoader({ label = "Cargando…" }) {
  return <div className="grid min-h-screen place-items-center bg-crema"><div className="flex flex-col items-center gap-3 text-choco"><Loader2 className="animate-spin" size={28} /><p className="text-sm">{label}</p></div></div>;
}

function AdminShellApp({ operator = false }) {
  const [session, setSession] = useState(null), [authLoading, setAuthLoading] = useState(true), [memberships, setMemberships] = useState([]), [selected, setSelected] = useState(''), [workspaceLoading, setWorkspaceLoading] = useState(true), [storageReady, setStorageReady] = useState(false), [storageStatus,setStorageStatus] = useState({state:'loading'}), [online,setOnline] = useState(navigator.onLine), [fatalError,setFatalError] = useState(''), [recoveryMode,setRecoveryMode] = useState(false), [setupOpen,setSetupOpen] = useState(false), [teamOpen,setTeamOpen] = useState(false);
  const [inviteCode] = useState(() => new URLSearchParams(window.location.search).get('join') || sessionStorage.getItem('ce-pending-invite') || '');
  const user = session?.user, userId = user?.id;
  const membership = memberships.find(m => m.business_id === selected), business = membership?.businesses;
  const currentStorage = useRef(null);
  const loadMembership = useCallback(async preferred => {
    if(!supabase || !userId)return;
    setFatalError('');
    try {
      const {data,error}=await supabase.from('business_members').select('business_id,role,businesses(id,name,owner_id)').eq('user_id',userId).order('joined_at');
      if(error)throw error;
      const list=(data || []).filter(m=>m.businesses);setMemberships(list);
      const saved = preferred || new URLSearchParams(window.location.search).get("business") || localStorage.getItem(`ce-active-business:${userId}`);
      setSelected(current => list.some(m=>m.business_id===saved) ? saved : list.some(m=>m.business_id===current) ? current : list[0]?.business_id || '');
      setSetupOpen(false);
      if(preferred) sessionStorage.removeItem('ce-pending-invite');
    } catch(e){setFatalError(e.message || 'No fue posible cargar tus negocios.');} finally{setWorkspaceLoading(false);}
  },[userId]);
  useEffect(()=>{
    if(inviteCode) {sessionStorage.setItem('ce-pending-invite',inviteCode);window.history.replaceState({},'',window.location.pathname);}
    if(!supabase){setAuthLoading(false);return;}
    let active=true;
    supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setFatalError(error.message);setSession(data?.session || null);setAuthLoading(false);}}).catch(e=>{if(active){setFatalError(e.message);setAuthLoading(false);}});
    const {data:listener}=supabase.auth.onAuthStateChange((event,next)=>{if(event==='PASSWORD_RECOVERY')setRecoveryMode(true);setSession(next || null);setAuthLoading(false);});
    return()=>{active=false;listener.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{setMemberships([]);setSelected('');setStorageReady(false);if(userId){setWorkspaceLoading(true);loadMembership();}},[userId,loadMembership]);
  useEffect(()=>{
    const goOnline=()=>{setOnline(true);if(userId)loadMembership();},goOffline=()=>setOnline(false);
    const visible=()=>{if(document.visibilityState==='visible' && navigator.onLine && userId)loadMembership();};
    window.addEventListener('online',goOnline);window.addEventListener('offline',goOffline);document.addEventListener('visibilitychange',visible);
    return()=>{window.removeEventListener('online',goOnline);window.removeEventListener('offline',goOffline);document.removeEventListener('visibilitychange',visible);};
  },[loadMembership,userId]);
  useEffect(()=>{
    if(!business || !userId)return;
    setStorageStatus({state:'loading'});
    const storage=createCloudStorage({supabase,businessId:business.id,userId,role:membership.role,onStatus:setStorageStatus});
    currentStorage.current=storage;window.storage=storage;window.businessContext={id:business.id,name:business.name,userId,role:membership.role};setStorageReady(true);
    localStorage.setItem(`ce-active-business:${userId}`,business.id);
    let timer;
    const channel=supabase.channel(`business-data-${business.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'business_data',filter:`business_id=eq.${business.id}`},()=>{storage.invalidate();clearTimeout(timer);timer=setTimeout(()=>window.dispatchEvent(new Event('cloud-storage-updated')),400);}).subscribe();
    return()=>{clearTimeout(timer);storage.dispose();supabase.removeChannel(channel);if(window.storage===storage){delete window.storage;delete window.businessContext;}setStorageReady(false);};
  },[business?.id,userId,membership?.role]);
  async function signOut(){for(const key of Object.keys(localStorage))if(key.startsWith(`control-emprende:v3:${userId}:`) || key.startsWith(`ojos_dulces_web_admin_secret_v1:${userId}:`))localStorage.removeItem(key);currentStorage.current?.dispose({clearCache:true});const {error}=await supabase.auth.signOut();if(error)setFatalError(error.message);}
  useEffect(()=>{const handler=()=>signOut();window.addEventListener('od-admin-signout',handler);return()=>window.removeEventListener('od-admin-signout',handler);},[userId]);
  if(!isSupabaseConfigured)return <ConfigurationMissing/>;
  if(authLoading)return <FullScreenLoader label="Comprobando acceso…"/>;
  if(recoveryMode)return <SetNewPasswordScreen onDone={()=>setRecoveryMode(false)}/>;
  if(!session)return <AuthScreen/>;
  if(operator)return <PlatformAdmin onSignOut={signOut}/>;
  if(fatalError)return <div className="min-h-screen bg-crema p-6"><ShellCard className="mx-auto max-w-lg p-6"><h2 className="text-lg font-semibold">No pudimos abrir el negocio</h2><p className="mt-3 text-sm">{fatalError}</p><button onClick={()=>loadMembership()} className="ce-button mt-4">Reintentar</button><button onClick={signOut} className="ce-text-button">Cerrar sesión</button></ShellCard></div>;
  if(workspaceLoading)return <FullScreenLoader label="Abriendo tus negocios…"/>;
  if(!business || setupOpen)return <BusinessSetup onReady={loadMembership} initialCode={inviteCode} onCancel={business?()=>setSetupOpen(false):undefined}/>;
  if(!storageReady)return <FullScreenLoader label="Conectando los datos…"/>;
  return <><WorkspaceBar business={business} memberships={memberships} membership={membership} user={user} online={online} storageStatus={storageStatus} onSignOut={signOut} onSelect={value=>{if(window.__ceDrafts && !window.confirm("Hay cambios sin guardar. ¿Cambiar de negocio y descartarlos?"))return;setStorageReady(false);setSelected(value);}} onCreate={()=>setSetupOpen(true)} onTeam={()=>setTeamOpen(true)}/><Suspense fallback={<FullScreenLoader/>}><BusinessApp key={`${business.id}:${userId}:${membership.role}`}/></Suspense>{teamOpen && <TeamPanel business={business} role={membership.role} onClose={()=>setTeamOpen(false)}/>}</>;
}

function DemoApp() {
  const [id,setId]=useState(DEMO_BUSINESSES[0].id),[ready,setReady]=useState(false),[generation,setGeneration]=useState(0);
  useEffect(()=>{const profile=DEMO_BUSINESSES.find(p=>p.id===id);const storage=createDemoStorage(profile);window.storage=storage;window.businessContext={...profile,userId:'demo',role:'owner',demo:true};setReady(true);return()=>{if(window.storage===storage){delete window.storage;delete window.businessContext;}setReady(false);};},[id,generation]);
  useEffect(()=>{const leave=()=>{if(import.meta.env.VITE_DEMO_ONLY === 'true'){window.alert(import.meta.env.VITE_DESKTOP === 'true' ? 'Esta es una demostración local. Puedes cerrar esta ventana cuando termines.' : 'Esta es una demostración local. Puedes cerrar esta pestaña cuando termines.');}else{window.location.href='/';}};window.addEventListener('od-admin-signout',leave);return()=>window.removeEventListener('od-admin-signout',leave);},[]);
  return <><div className="ce-demo-bar"><span><strong>Demostración</strong> · datos ficticios en este {import.meta.env.VITE_DESKTOP === 'true' ? 'equipo' : 'navegador'}</span><select aria-label="Negocio de demostración" value={id} onChange={e=>{if(window.__ceDrafts && !window.confirm("Hay cambios sin guardar. ¿Cambiar de negocio?"))return;setReady(false);setId(e.target.value);}}>{DEMO_BUSINESSES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={()=>{if(window.confirm('¿Restablecer los datos ficticios de este negocio?')){window.storage.reset();setReady(false);setGeneration(n=>n+1);}}}>Reiniciar demo</button>{import.meta.env.VITE_DEMO_ONLY !== 'true' && <a href="/">Salir</a>}</div>{ready?<Suspense fallback={<FullScreenLoader/>}><BusinessApp key={`${id}:${generation}`}/></Suspense>:<FullScreenLoader/>}</>;
}


function RedirectToHome() {
  useEffect(() => {
    if (typeof window !== "undefined") window.location.replace("/");
  }, []);
  return <FullScreenLoader label="Abriendo Control Emprende…" />;
}

// Commercial website and authenticated workspace share the same build.
export default function App() {
  if (import.meta.env.VITE_DESKTOP === 'true') return <Suspense fallback={<FullScreenLoader/>}><LocalWorkspace/></Suspense>;
  if (import.meta.env.VITE_DEMO_ONLY === 'true') return <DemoApp/>;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  if (path.startsWith('/catalogo/')) return <Suspense fallback={<FullScreenLoader label="Abriendo el catálogo…"/>}><PublicCatalog slug={path.slice('/catalogo/'.length)}/></Suspense>;
  if (params.get('demo') === '1') return <DemoApp/>;
  if (path === '/pedir' || params.get('pedir') === '1') return <Suspense fallback={<FullScreenLoader/>}><BusinessApp/></Suspense>;
  if (path === '/app' || path === '/admin' || params.has('join') || window.location.hash.includes('access_token') || params.has('code')) return <AdminShellApp/>;
  if (path === '/operador') return <AdminShellApp operator/>;
  if (path === '/') return <Landing/>;
  return <RedirectToHome/>;
}
