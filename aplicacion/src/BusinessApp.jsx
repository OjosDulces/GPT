import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBusinessProfile, setBusinessProfile, formatMoney, scopedKey, DEFAULT_PROFILE } from './domain/business.js';
import { KEY_TO_COLUMN, newId, validateBackup, finiteNumber, csvCell, roundMoney } from './domain/data.js';
import { saleInventory, purchaseInventory, productionInventory, financialSummary, localDay } from './domain/operations.js';
import { Overview, BusinessProfilePanel, QuickSearch, ProductGuide, AccessibleDialog, useDraftGuard } from './components/WorkspaceFeatures.jsx';
import { HealthCard, AdvisorPanel, GoalCard, ReportsPanel } from './components/AdvisorAndReports.jsx';
import { Onboarding, PreferencesPanel, ImportPanel, SupportPanel } from './components/GrowthAndSupport.jsx';
import CatalogManager from './components/CatalogManager.jsx';
import { BillingPanel } from './components/BillingAdmin.jsx';
import { reportDiagnostic } from './lib/services.js';
import CommandCenter from './components/CommandCenter.jsx';
import PersonalizeStudio, { WorkspaceMark } from './components/PersonalizeStudio.jsx';
import { DEFAULT_APPEARANCE, normalizeAppearance, appearanceTokens } from './domain/appearance.js';
const logo = '/favicon.svg';
import {
  AlertTriangle, ArrowRight, BarChart3, Boxes, Building2, CalendarDays,
  Check, CircleDollarSign, ClipboardList, CreditCard, Database, DollarSign,
  Download, Factory, FileText, History, LayoutDashboard, Loader2, MessageCircle, Minus,
  Package, PackagePlus, Pencil, Phone, Plus, Receipt, RefreshCw, Save,
  Search, ShoppingCart, Star, Trash2, TrendingUp, Truck, Upload, Users,
  WalletCards, X, XCircle, Settings, Eye, EyeOff, Moon, Sun, Monitor, Palette,
  SlidersHorizontal, Shield, RotateCcw, Sparkles, KeyRound, LogOut, Bell, ChevronDown, ChevronUp
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

// Ojos Dulces v10.7 — Web Push real tipo Shopify + pedidos web + clientes sin duplicados
// ============================================================
// Persistencia
// ============================================================
const STORAGE_KEYS = {
  products: "products",
  insumos: "insumos",
  customers: "customers",
  sales: "sales",
  quotes: "quotes_v2",
  expenses: "expenses_v2",
  suppliers: "suppliers_v2",
  productions: "productions_v2",
  movements: "inventory_movements_v2",
  budgets: "budgets_v2",
};

// Preferencias de interfaz: se guardan por dispositivo, no modifican los datos del negocio.
const DEVICE_SETTINGS_KEY = "ojos_dulces_ui_settings_v4";
const DEFAULT_DEVICE_SETTINGS = {
  theme: "light",
  palette: "emerald",
  density: "comfortable",
  textSize: "normal",
  initialPage: "resumen",
  rememberLastView: true,
  hideAmounts: false,
  reduceMotion: false,
  showTodayPanel: true,
  showQuickActions: true,
  showCostsInSale: false,
  defaultPaymentMethod: "Transferencia",
  defaultOrderStatus: "Pendiente",
  ...DEFAULT_APPEARANCE,
};

function loadDeviceSettings() {
  try {
    if (typeof window === "undefined") return { ...DEFAULT_DEVICE_SETTINGS };
    const raw = window.localStorage.getItem(scopedKey(DEVICE_SETTINGS_KEY));
    return normalizeAppearance(raw ? { ...DEFAULT_DEVICE_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_DEVICE_SETTINGS });
  } catch {
    return { ...DEFAULT_DEVICE_SETTINGS };
  }
}

function saveDeviceSettings(settings) {
  if (typeof window !== "undefined") window.localStorage.setItem(scopedKey(DEVICE_SETTINGS_KEY), JSON.stringify(settings));
}

// Navegación local: recuerda dónde estaba trabajando la persona en este dispositivo.
const DEVICE_NAV_KEY = "ojos_dulces_last_view_v1";
function loadDeviceNavigation() {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(scopedKey(DEVICE_NAV_KEY));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveDeviceNavigation(patch) {
  try {
    if (typeof window === "undefined") return;
    const current = loadDeviceNavigation();
    window.localStorage.setItem(scopedKey(DEVICE_NAV_KEY), JSON.stringify({ ...current, ...patch }));
  } catch {}
}
function clearDeviceNavigation() {
  try { if (typeof window !== "undefined") window.localStorage.removeItem(scopedKey(DEVICE_NAV_KEY)); } catch {}
}
function usePersistentView(key, fallback) {
  const [value, setValue] = useState(() => loadDeviceNavigation()[key] || fallback);
  useEffect(() => { saveDeviceNavigation({ [key]: value }); }, [key, value]);
  return [value, setValue];
}

// ============================================================
// Datos iniciales · v4.3 modal de compras optimizado + costos desde compras y conversión automática de unidades
// ============================================================
const DEFAULT_INSUMOS = [
  { id: "ins_harina", name: "Harina", unit: "g", stock: 5000, minStock: 1000, costPerUnit: 0, costSource: "pending" },
  { id: "ins_azucar", name: "Azúcar", unit: "g", stock: 3000, minStock: 500, costPerUnit: 0, costSource: "pending" },
  { id: "ins_huevos", name: "Huevos", unit: "unid", stock: 30, minStock: 12, costPerUnit: 0, costSource: "pending" },
  { id: "ins_manjar", name: "Manjar", unit: "g", stock: 3000, minStock: 500, costPerUnit: 0, costSource: "pending" },
  { id: "ins_choc", name: "Chocolate cobertura", unit: "g", stock: 3000, minStock: 500, costPerUnit: 0, costSource: "pending" },
  { id: "ins_coco", name: "Coco rallado", unit: "g", stock: 500, minStock: 100, costPerUnit: 0, costSource: "pending" },
  { id: "ins_mantequilla", name: "Mantequilla", unit: "g", stock: 2000, minStock: 400, costPerUnit: 0, costSource: "pending" },
  { id: "ins_azucarflor", name: "Azúcar flor", unit: "g", stock: 1000, minStock: 200, costPerUnit: 0, costSource: "pending" },
  { id: "ins_mani", name: "Maní/avellana molida", unit: "g", stock: 800, minStock: 150, costPerUnit: 0, costSource: "pending" },
  { id: "ins_mermelada", name: "Mermelada de frutilla", unit: "g", stock: 800, minStock: 150, costPerUnit: 0, costSource: "pending" },
  { id: "ins_crema", name: "Crema chantilly/pastelera", unit: "g", stock: 1000, minStock: 200, costPerUnit: 0, costSource: "pending" },
  { id: "ins_chocblanco", name: "Chocolate blanco", unit: "g", stock: 500, minStock: 100, costPerUnit: 0, costSource: "pending" },
  { id: "ins_barquillo", name: "Trocitos de barquillo", unit: "g", stock: 500, minStock: 100, costPerUnit: 0, costSource: "pending" },
  { id: "ins_envasepack", name: "Envase pack x4 (cuchuflí)", unit: "unid", stock: 30, minStock: 10, costPerUnit: 0, costSource: "pending" },
  { id: "ins_envaseind", name: "Envase individual (alfajor)", unit: "unid", stock: 80, minStock: 20, costPerUnit: 0, costSource: "pending" },
];

const MASA_ALFAJOR = [
  { insumoId: "ins_harina", qty: 20 },
  { insumoId: "ins_mantequilla", qty: 10 },
  { insumoId: "ins_azucarflor", qty: 6.67 },
];

const DEFAULT_PRODUCTS = [
  {
    id: "p1", name: "Cuchuflí Pack x4", price: 2200, category: "Cuchuflí", active: true,
    stock: 15, minStock: 5, laborCost: 250, otherCost: 80,
    recipe: [
      { insumoId: "ins_harina", qty: 50 }, { insumoId: "ins_azucar", qty: 30 },
      { insumoId: "ins_huevos", qty: 0.6 }, { insumoId: "ins_manjar", qty: 50 },
      { insumoId: "ins_choc", qty: 30 }, { insumoId: "ins_coco", qty: 10 },
      { insumoId: "ins_envasepack", qty: 1 },
    ],
  },
  {
    id: "p2", name: "Alfajor Manjarate", price: 750, category: "Alfajor", active: true,
    stock: 20, minStock: 8, laborCost: 100, otherCost: 30,
    recipe: [
      ...MASA_ALFAJOR,
      { insumoId: "ins_manjar", qty: 13.33 }, { insumoId: "ins_barquillo", qty: 3.33 },
      { insumoId: "ins_choc", qty: 6.67 }, { insumoId: "ins_envaseind", qty: 1 },
    ],
  },
  {
    id: "p3", name: "Alfajor Bon o Bon", price: 850, category: "Alfajor", active: true,
    stock: 15, minStock: 8, laborCost: 100, otherCost: 30,
    recipe: [
      ...MASA_ALFAJOR,
      { insumoId: "ins_choc", qty: 16.67 }, { insumoId: "ins_mani", qty: 5 },
      { insumoId: "ins_envaseind", qty: 1 },
    ],
  },
  {
    id: "p4", name: "Alfajor Torta Amor", price: 800, category: "Alfajor", active: true,
    stock: 15, minStock: 8, laborCost: 100, otherCost: 30,
    recipe: [
      ...MASA_ALFAJOR,
      { insumoId: "ins_manjar", qty: 10 }, { insumoId: "ins_mermelada", qty: 5 },
      { insumoId: "ins_crema", qty: 6.67 }, { insumoId: "ins_chocblanco", qty: 3.33 },
      { insumoId: "ins_envaseind", qty: 1 },
    ],
  },
];


// ============================================================
// Inventario inicial real · corte 15-08-2026
// ============================================================
const UNIT_OPTIONS = [
  { value: "g", label: "gramos (g) · aunque compres en kg" },
  { value: "ml", label: "mililitros (ml) · aunque compres en litros" },
  { value: "unid", label: "unidades" },
];

const LEGACY_PLACEHOLDER_COSTS = {
  ins_harina: 1.6, ins_azucar: 1.33, ins_huevos: 250, ins_manjar: 4.4, ins_choc: 10,
  ins_coco: 12, ins_mantequilla: 8, ins_azucarflor: 2.5, ins_mani: 12, ins_mermelada: 6,
  ins_crema: 8, ins_chocblanco: 15, ins_barquillo: 8, ins_envasepack: 300, ins_envaseind: 150,
};

function canonicalBaseUnit(unit) {
  const u = String(unit || "").toLowerCase().trim();
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos", "g", "gr", "gramo", "gramos"].includes(u)) return "g";
  if (["l", "lt", "lts", "litro", "litros", "ml", "mililitro", "mililitros"].includes(u)) return "ml";
  return "unid";
}

function purchaseUnitOptions(baseUnit) {
  if (baseUnit === "g") return [
    { value: "g", label: "gramos (g)", factor: 1 },
    { value: "kg", label: "kilos (kg)", factor: 1000 },
  ];
  if (baseUnit === "ml") return [
    { value: "ml", label: "mililitros (ml)", factor: 1 },
    { value: "l", label: "litros (L)", factor: 1000 },
  ];
  return [
    { value: "unid", label: "unidades", factor: 1 },
    { value: "docena", label: "docenas", factor: 12 },
  ];
}

function convertPurchaseToBase(qty, purchaseUnit, baseUnit) {
  const option = purchaseUnitOptions(baseUnit).find((item) => item.value === purchaseUnit);
  return option ? asNumber(qty) * option.factor : 0;
}

function normalizeInsumoForCosting(insumo) {
  const originalUnit = String(insumo?.unit || "g").toLowerCase();
  const baseUnit = canonicalBaseUnit(originalUnit);
  let stock = asNumber(insumo?.stock);
  let minStock = asNumber(insumo?.minStock);
  let rawCost = asNumber(insumo?.costPerUnit);
  if (originalUnit === "kg") { stock *= 1000; minStock *= 1000; rawCost /= 1000; }
  if (["l", "lt", "litro", "litros"].includes(originalUnit)) { stock *= 1000; minStock *= 1000; rawCost /= 1000; }
  const explicitSource = insumo?.costSource;
  const legacyPlaceholder = false;
  const costSource = explicitSource || (legacyPlaceholder || rawCost <= 0 ? "pending" : "manual");
  const costPerUnit = costSource === "pending" ? 0 : rawCost;
  return { ...insumo, unit: baseUnit, stock, minStock, costPerUnit, costSource };
}

function hasConfiguredCost(insumo) {
  return Boolean(insumo && insumo.costSource !== "pending" && asNumber(insumo.costPerUnit) >= 0);
}


const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Débito", "Crédito", "Otro"];
const ORDER_STATUSES = ["Pendiente", "En preparación", "Listo", "Entregado"];
const CUCHUFLI_PREP_OPTIONS = ["Estándar", "Solo chocolate", "Solo coco rallado", "Chocolate + coco", "Sin cobertura"];

function isCuchufliLine(item) {
  return /cuchuf/i.test(`${item?.name || ""} ${item?.category || ""}`);
}

function cleanPrepNote(value) {
  const text = String(value || "").trim();
  return text === "Estándar" ? "" : text;
}

function prepLabel(item) {
  return cleanPrepNote(item?.prepNote) || "Estándar";
}
const QUOTE_STATUSES = ["Borrador", "Enviado", "Aceptado", "Rechazado", "Vencido"];
const EXPENSE_CATEGORIES = ["Insumos", "Envases", "Despacho", "Publicidad", "Servicios", "Arriendo", "Maquinaria", "Impuestos", "Otros"];
const CHART_COLORS = ["#5A3420", "#C17817", "#C9A227", "#D98B8B", "#8B5E3C", "#E8B04B"];


// ============================================================
// Pedidos públicos · /pedir
// ============================================================
// Esta integración no requiere librerías nuevas. Cuando VITE_SUPABASE_URL y
// VITE_SUPABASE_ANON_KEY están configuradas, el catálogo y los encargos viajan
// por Supabase. Sin esas variables, /pedir funciona como vista previa local.
const PUBLIC_ORDER_LOCAL_KEY = "ojos_dulces_public_orders_preview_v1";
const WEB_ADMIN_SECRET_KEY = "ojos_dulces_web_admin_secret_v1";
const WEB_ORDER_NOTIFIED_KEY = "ojos_dulces_web_order_notified_v1";

function loadNotifiedWebOrderIds() {
  try {
    if (typeof window === "undefined") return new Set();
    const raw = window.localStorage.getItem(scopedKey(WEB_ORDER_NOTIFIED_KEY));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveNotifiedWebOrderIds(ids) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(scopedKey(WEB_ORDER_NOTIFIED_KEY), JSON.stringify([...ids].slice(-500)));
  } catch {}
}

const PUBLIC_SHOP_SLUG = String(import.meta.env?.VITE_SHOP_SLUG || "ojos-dulces").trim() || "ojos-dulces";
// URL canónica que se comparte con clientes. Así un alias o dominio antiguo de Netlify
// no vuelve a aparecer en el botón “Copiar enlace”. Puedes cambiarla en Vercel/Netlify
// mediante VITE_PUBLIC_SITE_URL sin modificar este archivo.
const PUBLIC_SITE_URL = String(import.meta.env?.VITE_PUBLIC_SITE_URL || window.location.origin)
  .trim()
  .replace(/\/+$/, "");
const SUPABASE_URL = String(import.meta.env?.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "");
const PUBLIC_ORDERS_CLOUD_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Web Push real. La clave pública puede quedar en el navegador; la privada vive sólo
// en Supabase Edge Functions. El valor de respaldo pertenece exclusivamente a Ojos Dulces.
const WEB_PUSH_VAPID_PUBLIC_KEY = String(import.meta.env?.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "BNliQrxAfn91dgt-bDMTpISI67pRzoxH6Zo_d7Y6m8SHfqd-DTSXcKrAFvE6tj29TLTHsR3aeRZ7WvREfRb3EtU").trim();

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneWebApp() {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone);
}

function pushSupportState() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") return "unsupported";
  if (isIOSDevice() && !isStandaloneWebApp()) return "needs-install";
  if (Notification.permission === "denied") return "denied";
  return "available";
}

function pushDeviceLabel() {
  if (typeof navigator === "undefined") return "Dispositivo";
  if (isIOSDevice()) return "iPhone / iPad";
  if (/android/i.test(navigator.userAgent || "")) return "Android";
  if (/macintosh|mac os x/i.test(navigator.userAgent || "")) return "Mac";
  if (/windows/i.test(navigator.userAgent || "")) return "PC Windows";
  return "Navegador";
}

function normalizePushSubscription(subscription) {
  if (!subscription) return null;
  const json = typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return null;
  return { endpoint: json.endpoint, expirationTime: json.expirationTime || null, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function comparablePhoneKey(value) {
  const digits = normalizePhoneDigits(value);
  // Para Chile, +56 9XXXXXXXX y 9XXXXXXXX representan el mismo móvil.
  // Usar los últimos 9 dígitos también tolera formatos distintos al escribirlo.
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function normalizeCustomerName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function customerNameSimilarity(leftName, rightName) {
  const left = normalizeCustomerName(leftName);
  const right = normalizeCustomerName(rightName);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const maxLength = Math.max(left.length, right.length);
  const distanceScore = maxLength ? 1 - (levenshteinDistance(left, right) / maxLength) : 0;
  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const common = [...leftSet].filter((token) => rightSet.has(token)).length;
  const tokenScore = (leftSet.size + rightSet.size) ? (2 * common) / (leftSet.size + rightSet.size) : 0;

  const shorterTokens = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longerSet = leftTokens.length <= rightTokens.length ? rightSet : leftSet;
  const containedName = shorterTokens.length >= 2 && shorterTokens.every((token) => longerSet.has(token));

  const leftFirst = leftTokens[0] || "";
  const rightFirst = rightTokens[0] || "";
  const leftLast = leftTokens[leftTokens.length - 1] || "";
  const rightLast = rightTokens[rightTokens.length - 1] || "";
  const sameLast = leftTokens.length >= 2 && rightTokens.length >= 2 && leftLast === rightLast;
  const similarFirst = leftFirst.length >= 3 && rightFirst.length >= 3
    && (leftFirst.startsWith(rightFirst) || rightFirst.startsWith(leftFirst));

  return Math.max(
    distanceScore,
    tokenScore,
    containedName ? 0.93 : 0,
    sameLast && similarFirst ? 0.94 : 0,
  );
}

function findExistingCustomerMatch(customers, { name, phone }) {
  const list = Array.isArray(customers) ? customers : [];
  const phoneKey = comparablePhoneKey(phone);
  const nameKey = normalizeCustomerName(name);

  if (phoneKey.length >= 8) {
    const phoneMatches = list.filter((customer) => comparablePhoneKey(customer.phone) === phoneKey);
    if (phoneMatches.length === 1) return { customer: phoneMatches[0], method: "phone", score: 1 };
    if (phoneMatches.length > 1 && nameKey) {
      const bestByName = phoneMatches
        .map((customer) => ({ customer, score: customerNameSimilarity(name, customer.name) }))
        .sort((a, b) => b.score - a.score)[0];
      if (bestByName?.score >= 0.82) return { ...bestByName, method: "phone+name" };
    }
  }

  if (!nameKey) return null;
  const exactNameMatches = list.filter((customer) => normalizeCustomerName(customer.name) === nameKey);
  if (exactNameMatches.length === 1) return { customer: exactNameMatches[0], method: "exact-name", score: 1 };

  const candidates = list
    .map((customer) => ({ customer, score: customerNameSimilarity(name, customer.name) }))
    .filter((entry) => entry.score >= 0.88)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  const [best, second] = candidates;
  // Si hay dos personas prácticamente iguales, es preferible crear/revisar antes que unir mal historiales.
  if (second && best.score - second.score < 0.06) return null;
  return { ...best, method: "similar-name" };
}

function loadWebAdminSecret() {
  try { return typeof window !== "undefined" ? (window.localStorage.getItem(scopedKey(WEB_ADMIN_SECRET_KEY)) || "") : ""; } catch { return ""; }
}

function saveWebAdminSecret(value) {
  try {
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(scopedKey(WEB_ADMIN_SECRET_KEY), value);
    else window.localStorage.removeItem(scopedKey(WEB_ADMIN_SECRET_KEY));
  } catch {}
}

async function supabaseRpc(name, body) {
  if (!PUBLIC_ORDERS_CLOUD_READY) throw new Error("Supabase aún no está configurado.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!response.ok) {
    const message = parsed?.message || parsed?.error || parsed?.hint || `Error ${response.status}`;
    throw new Error(message);
  }
  return parsed;
}

async function fetchPublicCatalog() {
  if (PUBLIC_ORDERS_CLOUD_READY) {
    const rows = await supabaseRpc("public_catalog", { p_shop_slug: PUBLIC_SHOP_SLUG });
    return (rows || []).map((row) => ({
      id: row.id,
      name: row.name,
      price: asNumber(row.price),
      category: row.category || "Otros",
      image: row.image || "",
      active: row.active !== false,
    }));
  }
  const local = await loadKey(STORAGE_KEYS.products, DEFAULT_PRODUCTS);
  return (local || DEFAULT_PRODUCTS).filter((item) => item.active !== false);
}

async function submitPublicOrder(payload) {
  if (PUBLIC_ORDERS_CLOUD_READY) {
    return supabaseRpc("place_public_order", {
      p_shop_slug: PUBLIC_SHOP_SLUG,
      p_customer_name: payload.customerName,
      p_customer_phone: payload.customerPhone,
      p_delivery_date: payload.deliveryDate || null,
      p_delivery_time: payload.deliveryTime || null,
      p_delivery_method: payload.deliveryMethod || "Retiro",
      p_notes: payload.notes || "",
      p_items: payload.items.map((item) => ({
        productId: item.productId,
        qty: asNumber(item.qty),
        prepNote: isCuchufliLine(item) ? cleanPrepNote(item.prepNote) : "",
      })),
    });
  }

  // Vista previa local: permite probar todo el flujo antes de crear Supabase.
  const current = await loadKey(PUBLIC_ORDER_LOCAL_KEY, []);
  const createdAt = todayISO();
  const normalizedItems = payload.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    price: asNumber(item.price),
    qty: asNumber(item.qty),
    prepNote: isCuchufliLine(item) ? cleanPrepNote(item.prepNote) : "",
  }));
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const order = {
    id: uid("web"),
    public_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
    shop_slug: PUBLIC_SHOP_SLUG,
    customer_name: payload.customerName,
    customer_phone: payload.customerPhone,
    delivery_date: payload.deliveryDate || "",
    delivery_time: payload.deliveryTime || "",
    delivery_method: payload.deliveryMethod || "Retiro",
    notes: payload.notes || "",
    items: normalizedItems,
    subtotal,
    total: subtotal,
    status: "Nuevo",
    created_at: createdAt,
    local_preview: true,
  };
  const ok = await saveKey(PUBLIC_ORDER_LOCAL_KEY, [order, ...(current || [])]);
  if (!ok) throw new Error("No fue posible guardar el pedido de prueba.");
  return { id: order.id, code: order.public_code, total: order.total, preview: true };
}

async function fetchAdminWebOrders(adminSecret) {
  if (PUBLIC_ORDERS_CLOUD_READY) {
    if (!adminSecret) return [];
    return (await supabaseRpc("admin_list_orders", {
      p_shop_slug: PUBLIC_SHOP_SLUG,
      p_admin_secret: adminSecret,
    })) || [];
  }
  return (await loadKey(PUBLIC_ORDER_LOCAL_KEY, [])) || [];
}

async function publishPublicCatalog(products, adminSecret) {
  if (!PUBLIC_ORDERS_CLOUD_READY) return { preview: true, count: products.filter((p) => p.active !== false).length };
  if (!adminSecret) throw new Error("Ingresa tu clave privada de pedidos web.");
  const payload = products.map((product, index) => ({
    id: product.id,
    name: product.name,
    price: asNumber(product.price),
    category: product.category || "Otros",
    image: product.image || "",
    active: product.active !== false,
    sortOrder: index,
  }));
  return supabaseRpc("admin_sync_catalog", {
    p_shop_slug: PUBLIC_SHOP_SLUG,
    p_admin_secret: adminSecret,
    p_products: payload,
  });
}

async function markAdminWebOrder(orderId, status, localSaleId, adminSecret) {
  if (PUBLIC_ORDERS_CLOUD_READY) {
    if (!adminSecret) throw new Error("Falta la clave privada de pedidos web.");
    return supabaseRpc("admin_update_order", {
      p_shop_slug: PUBLIC_SHOP_SLUG,
      p_admin_secret: adminSecret,
      p_order_id: orderId,
      p_status: status,
      p_local_sale_id: localSaleId || null,
    });
  }
  const current = await loadKey(PUBLIC_ORDER_LOCAL_KEY, []);
  const next = (current || []).map((order) => order.id === orderId ? {
    ...order,
    status,
    local_sale_id: localSaleId || order.local_sale_id || null,
    imported_at: status === "Importado" ? todayISO() : order.imported_at,
  } : order);
  await saveKey(PUBLIC_ORDER_LOCAL_KEY, next);
  return true;
}

async function deleteAdminWebOrder(orderId, adminSecret) {
  if (PUBLIC_ORDERS_CLOUD_READY) {
    if (!adminSecret) throw new Error("Falta la clave privada de pedidos web.");
    return supabaseRpc("admin_delete_order", {
      p_shop_slug: PUBLIC_SHOP_SLUG,
      p_admin_secret: adminSecret,
      p_order_id: orderId,
    });
  }
  const current = await loadKey(PUBLIC_ORDER_LOCAL_KEY, []);
  const next = (current || []).filter((order) => order.id !== orderId);
  await saveKey(PUBLIC_ORDER_LOCAL_KEY, next);
  return true;
}

async function registerAdminPushSubscription(adminSecret, subscription) {
  if (!PUBLIC_ORDERS_CLOUD_READY) throw new Error("Supabase aún no está configurado.");
  if (!adminSecret) throw new Error("Primero guarda la clave privada de Pedidos web.");
  const normalized = normalizePushSubscription(subscription);
  if (!normalized) throw new Error("La suscripción push no es válida.");
  return supabaseRpc("admin_register_push_subscription", {
    p_shop_slug: PUBLIC_SHOP_SLUG,
    p_admin_secret: adminSecret,
    p_subscription: normalized,
    p_device_name: pushDeviceLabel(),
  });
}

async function unregisterAdminPushSubscription(adminSecret, endpoint) {
  if (!PUBLIC_ORDERS_CLOUD_READY || !adminSecret || !endpoint) return false;
  return supabaseRpc("admin_unregister_push_subscription", {
    p_shop_slug: PUBLIC_SHOP_SLUG,
    p_admin_secret: adminSecret,
    p_endpoint: endpoint,
  });
}

// ============================================================
// Utilidades
// ============================================================
const RAW_CLP = (n) => formatMoney(n);
let MASK_SCREEN_AMOUNTS = false;
const CLP = (n) => MASK_SCREEN_AMOUNTS ? "$ •••••" : RAW_CLP(n);

function whatsappUrl(phone, message) {
  const digits = String(phone || "").replace(/\D/g, "");
  const withCountry = digits.length > 0 && digits.length <= 9 ? `${getBusinessProfile().countryCode}${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function buildReceiptText(sale) {
  const lines = sale.items.map((i) => {
    const prep = isCuchufliLine(i) ? cleanPrepNote(i.prepNote) : "";
    return `• ${i.qty}x ${i.name} — ${RAW_CLP(i.price * i.qty)}${prep ? `\n  ↳ ${prep}` : ""}`;
  }).join("\n");
  const extras = [
    sale.discount ? `Descuento: -${RAW_CLP(sale.discount)}` : null,
    sale.delivery ? `Despacho: ${RAW_CLP(sale.delivery)}` : null,
  ].filter(Boolean).join("\n");
  const scheduledDelivery = sale.deliveryDate ? `\nEntrega: ${deliveryLabel(sale)}` : "";
  return `*${getBusinessProfile().name}*\n¡Gracias por tu compra!\n\n${lines}\n${extras ? extras + "\n" : ""}\n*Total: ${RAW_CLP(sale.total)}*\n${sale.balance > 0 ? `Saldo pendiente: ${RAW_CLP(sale.balance)}` : "Estado: Pagado ✅"}${scheduledDelivery}\n\nFecha: ${fmtDate(sale.dateISO, false)}`;
}

function buildQuoteText(quote) {
  const lines = quote.items.map((i) => `• ${i.qty}x ${i.name} — ${RAW_CLP(i.price * i.qty)}`).join("\n");
  return `*${getBusinessProfile().name}*\nCotización\n\n${lines}\n\n*Total: ${RAW_CLP(quote.total)}*\nVálida hasta: ${fmtDate(quote.validUntil, false)}${quote.notes ? `\n\n${quote.notes}` : ""}`;
}

let logoImagePromise = null;
function loadLogoImage() {
  if (!logoImagePromise) {
    logoImagePromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = logo;
    });
  }
  return logoImagePromise;
}

async function generateReceiptImage(sale) {
  try { await document.fonts.load('600 30px "Cormorant Garamond"'); await document.fonts.load('700 15px "Nunito"'); await document.fonts.load('400 15px "Nunito"'); } catch {}
  const logoImg = await loadLogoImage();
  const W = 640;
  const rowH = 26;
  const H = 300 + sale.items.length * rowH + 140;
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#FBF1E4"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 24, 24, W - 48, H - 48, 20); ctx.fill();
  ctx.strokeStyle = "rgba(201,162,39,0.35)"; ctx.lineWidth = 1;
  roundRect(ctx, 24, 24, W - 48, H - 48, 20); ctx.stroke();

  let y = 70;
  if (logoImg) { ctx.save(); ctx.beginPath(); ctx.arc(75, y, 34, 0, Math.PI * 2); ctx.closePath(); ctx.clip(); ctx.drawImage(logoImg, 41, y - 34, 68, 68); ctx.restore(); }
  ctx.fillStyle = "#5A3420"; ctx.font = '600 28px "Cormorant Garamond", serif'; ctx.textBaseline = "alphabetic";
  ctx.fillText(getBusinessProfile().name, 128, y - 2);
  ctx.fillStyle = "#C17817"; ctx.font = '700 11px "Nunito", sans-serif';
  ctx.fillText("COMPROBANTE INTERNO · NO TRIBUTARIO", 128, y + 16);

  y += 55;
  ctx.strokeStyle = "rgba(201,162,39,0.3)"; ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(W - 56, y); ctx.stroke();
  y += 30;
  ctx.fillStyle = "#5A3420"; ctx.font = '600 15px "Nunito", sans-serif';
  ctx.fillText(sale.customerName || "Cliente", 56, y);
  ctx.textAlign = "right"; ctx.fillStyle = "#5A342099"; ctx.font = '400 12px "Nunito", sans-serif';
  ctx.fillText(fmtDate(sale.dateISO, false), W - 56, y);
  ctx.textAlign = "left";

  y += 30;
  ctx.fillStyle = "#5A342088"; ctx.font = '700 11px "Nunito", sans-serif';
  ctx.fillText("PRODUCTO", 56, y); ctx.textAlign = "right"; ctx.fillText("SUBTOTAL", W - 56, y); ctx.textAlign = "left";
  y += 12;
  ctx.strokeStyle = "rgba(201,162,39,0.25)"; ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(W - 56, y); ctx.stroke();

  y += 24;
  ctx.font = '400 14px "Nunito", sans-serif';
  sale.items.forEach((item) => {
    ctx.fillStyle = "#5A3420";
    ctx.fillText(`${item.qty}x ${item.name}`, 56, y);
    ctx.textAlign = "right"; ctx.fillText(RAW_CLP(item.price * item.qty), W - 56, y); ctx.textAlign = "left";
    y += rowH;
  });

  y += 6;
  ctx.strokeStyle = "rgba(201,162,39,0.3)"; ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(W - 56, y); ctx.stroke();
  y += 26;
  const summaryLine = (label, value, opts = {}) => {
    ctx.font = opts.bold ? '700 15px "Nunito", sans-serif' : '400 13px "Nunito", sans-serif';
    ctx.fillStyle = opts.color || "#5A342099";
    ctx.fillText(label, 56, y); ctx.textAlign = "right"; ctx.fillText(value, W - 56, y); ctx.textAlign = "left"; y += opts.bold ? 26 : 20;
  };
  summaryLine("Subtotal", RAW_CLP(sale.subtotal));
  if (sale.discount) summaryLine("Descuento", "-" + RAW_CLP(sale.discount));
  if (sale.delivery) summaryLine("Despacho", RAW_CLP(sale.delivery));
  summaryLine("Total", RAW_CLP(sale.total), { bold: true, color: "#5A3420" });
  summaryLine(sale.balance > 0 ? "Saldo pendiente" : "Estado", sale.balance > 0 ? RAW_CLP(sale.balance) : "Pagado ✓", { color: sale.balance > 0 ? "#C17817" : "#5A342099" });

  y += 10;
  ctx.textAlign = "center"; ctx.fillStyle = "#5A342070"; ctx.font = '400 12px "Nunito", sans-serif';
  ctx.fillText("¡Gracias por tu compra!", W / 2, y);
  ctx.textAlign = "left";

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function shareReceiptImage(sale) {
  const blob = await generateReceiptImage(sale);
  if (!blob) return;
  const file = new File([blob], `comprobante-${sale.id}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `Comprobante ${getBusinessProfile().name}` }); return; } catch { /* user cancelled or unsupported, fall back below */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `comprobante-${sale.id}.png`; a.click();
  URL.revokeObjectURL(url);
}

const CLUB_STAMP_TARGET = 5;
const CLUB_CARD_SLOTS = CLUB_STAMP_TARGET;

async function generateClubCardImage(customer, stampsFilled) {
  try { await document.fonts.load('600 26px "Cormorant Garamond"'); await document.fonts.load('700 12px "Nunito"'); await document.fonts.load('400 12px "Nunito"'); } catch {}
  const logoImg = await loadLogoImage();
  const W = 640, H = 400, scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#FBF1E4"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 24, 24, W - 48, H - 48, 20); ctx.fill();
  ctx.strokeStyle = "rgba(201,162,39,0.35)"; ctx.lineWidth = 1;
  roundRect(ctx, 24, 24, W - 48, H - 48, 20); ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#5A3420"; ctx.font = '600 26px "Cormorant Garamond", serif';
  ctx.fillText(`Tarjeta Club ${getBusinessProfile().name}`, W / 2, 78);
  ctx.fillStyle = "#C17817"; ctx.font = '700 12px "Nunito", sans-serif';
  ctx.fillText((customer.name || "").toUpperCase(), W / 2, 100);

  const size = 78, gap = 22;
  const totalW = CLUB_CARD_SLOTS * size + (CLUB_CARD_SLOTS - 1) * gap;
  let x = (W - totalW) / 2;
  const y = 140;
  for (let i = 0; i < CLUB_CARD_SLOTS; i++) {
    const cx = x + size / 2, cy = y + size / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.closePath();
    ctx.strokeStyle = "rgba(201,162,39,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.clip();
    ctx.globalAlpha = i < stampsFilled ? 0.12 : 1;
    if (logoImg) ctx.drawImage(logoImg, x, y, size, size);
    ctx.restore();
    x += size + gap;
  }

  const complete = stampsFilled >= CLUB_CARD_SLOTS;
  ctx.fillStyle = "#5A3420"; ctx.font = '700 16px "Nunito", sans-serif';
  ctx.fillText(complete ? "¡Tarjeta completa! Tu próximo producto es gratis 🎁" : `${stampsFilled} de ${CLUB_CARD_SLOTS} compras — ¡ya casi!`, W / 2, y + size + 44);
  ctx.fillStyle = "#5A342088"; ctx.font = '400 12px "Nunito", sans-serif';
  ctx.fillText(getBusinessProfile().tagline, W / 2, y + size + 66);
  ctx.textAlign = "left";

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function shareClubCard(customer, stampsFilled, captionText) {
  const blob = await generateClubCardImage(customer, stampsFilled);
  if (!blob) return;
  const file = new File([blob], `tarjeta-club-${customer.id}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `Tarjeta Club ${getBusinessProfile().name}`, text: captionText }); return; } catch { /* fall back below */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `tarjeta-club-${customer.id}.png`; a.click();
  URL.revokeObjectURL(url);
}
const NUM = (n, d = 0) => (Number(n) || 0).toLocaleString("es-CL", { maximumFractionDigits: d, minimumFractionDigits: d });
const uid = newId;
const todayISO = () => new Date().toISOString();
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayDate = () => localDateKey(new Date());
const tomorrowDate = () => { const date = new Date(); date.setDate(date.getDate() + 1); return localDateKey(date); };
const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const asNumber = (value) => Number(value) || 0;

function fmtDeliveryDate(dateString) {
  if (!dateString) return "Sin fecha";
  const [year, month, day] = String(dateString).split("-").map(Number);
  if (!year || !month || !day) return dateString;
  return new Date(year, month - 1, day).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" });
}

function deliveryLabel(sale) {
  if (!sale?.deliveryDate) return "Entrega sin programar";
  return `${fmtDeliveryDate(sale.deliveryDate)}${sale.deliveryTime ? ` · ${sale.deliveryTime}` : ""}`;
}

function deliverySortValue(sale) {
  if (!sale?.deliveryDate) return Number.MAX_SAFE_INTEGER;
  const time = sale.deliveryTime || "23:59";
  const value = new Date(`${sale.deliveryDate}T${time}:00`).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function fmtDate(iso, includeTime = true) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const date = d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  if (!includeTime) return date;
  return `${date} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

function isSameMonth(iso, date = new Date()) {
  const d = new Date(iso);
  return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
}

const csvEscape = csvCell;

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(filename, "\ufeff" + csv, "text/csv;charset=utf-8;");
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Fotos de productos: reduce imágenes tomadas desde iPhone antes de guardarlas.
// El resultado se guarda como data URL dentro del producto, por lo que no requiere
// una carpeta adicional ni subir archivos manualmente a GitHub.
function compressProductImage(file, maxSide = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("Selecciona una imagen válida."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No fue posible procesar esta imagen."));
      img.onload = () => {
        const sourceW = Math.max(1, img.naturalWidth || img.width || 1);
        const sourceH = Math.max(1, img.naturalHeight || img.height || 1);
        const scale = Math.min(1, maxSide / Math.max(sourceW, sourceH));
        const width = Math.max(1, Math.round(sourceW * scale));
        const height = Math.max(1, Math.round(sourceH * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No fue posible procesar la imagen.")); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#FBF1E4";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("No fue posible comprimir la imagen.")); return; }
          const resultReader = new FileReader();
          resultReader.onerror = () => reject(new Error("No fue posible guardar la imagen."));
          resultReader.onload = () => resolve(String(resultReader.result || ""));
          resultReader.readAsDataURL(blob);
        }, "image/jpeg", quality);
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function productCostBreakdown(product, insumos) {
  const hasCustomCosting = Boolean(product?.costing?.enabled && product?.costing?.recipe?.length);
  const rows = hasCustomCosting ? product.costing.recipe : (product.recipe || []);
  const divisor = hasCustomCosting ? Math.max(1, asNumber(product.costing.yieldQty) || 1) : 1;
  let ingredients = 0;
  let packaging = 0;
  const missingCosts = [];
  const lines = rows.map((item) => {
    const insumo = insumos.find((i) => i.id === item.insumoId);
    const configured = hasConfiguredCost(insumo);
    const rawCost = configured ? asNumber(insumo.costPerUnit) * asNumber(item.qty) : 0;
    const unitCost = rawCost / divisor;
    const isPackaging = /envase|bolsa|sticker|etiqueta|manga/i.test(insumo?.name || "");
    if (!configured) missingCosts.push(insumo?.name || "Insumo eliminado");
    if (isPackaging) packaging += unitCost;
    else ingredients += unitCost;
    return { ...item, name: insumo?.name || "Insumo eliminado", unit: insumo?.unit || "", costPerUnit: asNumber(insumo?.costPerUnit), lineCost: unitCost, isPackaging, missingCost: !configured };
  });
  const waste = ingredients * Math.max(0, asNumber(product.wastePercent)) / 100;
  const labor = asNumber(product.laborCost);
  const other = asNumber(product.otherCost);
  const total = ingredients + packaging + waste + labor + other;
  return { ingredients, packaging, waste, labor, other, total, lines, missingCosts: [...new Set(missingCosts)], source: hasCustomCosting ? "Costeo por lote" : "Receta de producción", yieldQty: divisor };
}

function productUnitCost(product, insumos) {
  return productCostBreakdown(product, insumos).total;
}

function totalsFromItems(items, discount = 0, delivery = 0) {
  const subtotal = items.reduce((sum, item) => sum + asNumber(item.price) * asNumber(item.qty), 0);
  const total = Math.max(0, subtotal - asNumber(discount) + asNumber(delivery));
  return { subtotal, total };
}

function paymentStatus(total, paidAmount) {
  const paid = asNumber(paidAmount);
  if (paid <= 0) return "Pendiente";
  if (paid + 0.01 >= asNumber(total)) return "Pagado";
  return "Parcial";
}

function statusColor(status) {
  if (["Pagado", "Entregado", "Aceptado"].includes(status)) return "emerald";
  if (["Pendiente", "Parcial", "En preparación", "Enviado", "Borrador"].includes(status)) return "amber";
  if (["Rechazado", "Vencido"].includes(status)) return "red";
  return "stone";
}

// ============================================================
// Navegación y átomos UI
// ============================================================
const NAV_ITEMS = [
  { id: "resumen", label: "Inicio", shortLabel: "Inicio", icon: LayoutDashboard, group: "Principal" },
  { id: "asesor", label: "Mi asesor", shortLabel: "Asesor", icon: Sparkles, group: "Principal" },
  { id: "venta", label: "Nueva venta", shortLabel: "Venta", icon: ShoppingCart, group: "Principal" },
  { id: "pedidos", label: "Pedidos y pagos", shortLabel: "Pedidos", icon: ClipboardList, group: "Gestión" },
  ...(import.meta.env.VITE_ENABLE_LEGACY_SHOP === 'true' ? [{ id: 'webpedidos', label: 'Pedidos web', shortLabel: 'Web', icon: Download, group: 'Gestión' }] : []),
  { id: "pagina", label: "Mi página web", shortLabel: "Mi web", icon: Eye, group: "Gestión" },
  { id: "clientes", label: "Clientes", shortLabel: "Clientes", icon: Users, group: "Gestión" },
  { id: "finanzas", label: "Finanzas", shortLabel: "Finanzas", icon: WalletCards, group: "Gestión" },
  { id: "inventario", label: "Inventario y producción", shortLabel: "Inventario", icon: Boxes, group: "Gestión" },
  { id: "graficos", label: "Gráficos", shortLabel: "Gráficos", icon: BarChart3, group: "Más" },
  { id: "negocio", label: "Mi negocio", shortLabel: "Negocio", icon: Building2, group: "Sistema" },
  { id: "informes", label: "Informes", shortLabel: "Informes", icon: FileText, group: "Más" },
  { id: "importar", label: "Importar Excel / CSV", shortLabel: "Importar", icon: Upload, group: "Más" },
  { id: "preferencias", label: "Metas y asesor", shortLabel: "Metas", icon: TrendingUp, group: "Sistema" },
  { id: "planes", label: "Plan y pagos", shortLabel: "Planes", icon: CreditCard, group: "Sistema" },
  { id: "guia", label: "Ayuda y soporte", shortLabel: "Ayuda", icon: MessageCircle, group: "Sistema" },
  { id: "costos", label: "Productos", shortLabel: "Productos", icon: Package, group: "Más" },
  { id: "cotizaciones", label: "Cotizaciones", shortLabel: "Cotizar", icon: FileText, group: "Más" },
  { id: "historial", label: "Registros", shortLabel: "Registros", icon: History, group: "Más" },
  { id: "configuracion", label: "Ajustes", shortLabel: "Ajustes", icon: Settings, group: "Sistema" },
];

const PAGE_META = {
  pagina: ["Mi página web", "Tu catálogo público, conectado a los productos de tu negocio."],
  asesor: ["Mi asesor", "Señales útiles, explicadas con tus registros."],
  informes: ["Informes del negocio", "Ventas, caja y resultado estimado en una sola lectura."],
  importar: ["Importar Excel y CSV", "Trae tus productos y clientes con una revisión antes de guardar."],
  preferencias: ["Metas y asesor", "Define objetivos y elige cómo se analizan tus datos."],
  planes: ["Plan y pagos", "Tu acceso, los límites y el historial de pagos."],
  resumen: ["Tu negocio, a tu manera.", "Tu visión. Tus decisiones. Tu siguiente paso."],
  negocio: ["Mi negocio", "Una herramienta que se adapta a tu forma de trabajar."],
  guia: ["Ayuda y soporte", "Respuestas prácticas para seguir avanzando."],
  venta: ["Nueva venta", "Registra la venta, el cliente, el pago y la entrega."],
  pedidos: ["Pedidos y pagos", "Revisa entregas, estados y saldos pendientes."],
  webpedidos: ["Pedidos web", "Encargos enviados directamente por tus clientes."],
  clientes: ["Clientes", "Compras, contacto y fidelización en un solo lugar."],
  finanzas: ["Finanzas", "Ingresos, gastos, cobros y presupuesto del negocio."],
  costos: ["Productos", "Precios y costos cuando necesites revisarlos."],
  catalogo: ["Catálogo", "Productos y servicios con sus precios, fotos y categorías."],
  cotizaciones: ["Cotizaciones", "Crea propuestas y conviértelas en ventas."],
  historial: ["Registros", "Consulta ventas y gastos anteriores."],
  configuracion: ["Ajustes", "Tu espacio, tus preferencias y el respaldo de tu información."],
  inventario: ["Inventario y producción", "Existencias, compras, fabricación y ajustes con historial."],
  graficos: ["Gráficos", "Análisis avanzado."],
};

function NavAlert({ value }) {
  if (!value) return null;
  return <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-rosa text-white text-[10px] font-bold flex items-center justify-center">{value > 99 ? "99+" : value}</span>;
}

function DesktopNav({ tab, setTab, alerts }) {
  const groups = ["Principal", "Gestión", "Más", "Sistema"];
  const groupLabels = {Principal:"Día a día",Gestión:"Mi negocio",Más:"Análisis y herramientas",Sistema:"Configuración"};
  return (
    <nav className="workspace-navigation" aria-label="Navegación principal">
      {groups.map((group) => (
        <div key={group}>
          <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-choco/35">{groupLabels[group]}</p>
          <div className="space-y-1">
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button key={item.id} aria-current={active?"page":undefined} onClick={() => setTab(item.id)}
                  className={"w-full min-h-11 px-3 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all " +
                    (active ? "bg-choco text-crema shadow-sm" : "text-choco/70 hover:bg-white hover:text-choco")}>
                  <span className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " + (active ? "bg-white/10" : "bg-white border border-oro/15")}>
                    <Icon size={16} />
                  </span>
                  <span className="whitespace-normal leading-tight">{item.label}</span>
                  <NavAlert value={alerts[item.id]} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function MobileNav({ tab, setTab, alerts, onMore }) {
  const primary = ["resumen", "venta", "pedidos", "finanzas"];
  const moreActive = !primary.includes(tab);
  return (
    <nav className="od-mobile-nav lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-oro/20 bg-white/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]" aria-label="Navegación móvil">
      <div className="grid grid-cols-5 h-[66px]">
        {primary.map((id) => {
          const item = NAV_ITEMS.find((entry) => entry.id === id);
          const Icon = item.icon;
          const active = tab === id;
          return <button key={id} onClick={() => setTab(id)} className={"relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors " + (active ? "text-choco" : "text-choco/45")}>
            <span className={"w-9 h-8 rounded-xl flex items-center justify-center " + (active ? "bg-oro/20" : "")}>
              <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
            </span>
            <span>{item.shortLabel}</span>
            {alerts[id] > 0 && <span className="absolute top-1.5 left-1/2 ml-2.5 min-w-4 h-4 px-1 rounded-full bg-rosa text-white text-[9px] flex items-center justify-center">{alerts[id] > 9 ? "9+" : alerts[id]}</span>}
          </button>;
        })}
        <button onClick={onMore} className={"relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors " + (moreActive ? "text-choco" : "text-choco/45")}>
          <span className={"w-9 h-8 rounded-xl flex items-center justify-center " + (moreActive ? "bg-oro/20" : "")}><Plus size={20} /></span>
          <span>Más</span>
          {(["clientes", "cotizaciones", "finanzas", "costos", "historial", "configuracion"].reduce((sum, id) => sum + (alerts[id] || 0), 0) > 0) && <span className="absolute top-1.5 left-1/2 ml-2.5 w-2 h-2 rounded-full bg-rosa" />}
        </button>
      </div>
    </nav>
  );
}

function MobileMoreSheet({ open, onClose, tab, setTab, alerts }) {
  if (!open) return null;
  const items = NAV_ITEMS.filter((item) => !["resumen", "venta", "pedidos", "finanzas"].includes(item.id));
  return (
    <div className="lg:hidden fixed inset-0 z-[60] bg-choco/35 flex items-end" onClick={onClose}>
      <div className="w-full workspace-more-sheet bg-white rounded-t-[28px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-choco/15 mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <div><p className="font-brand text-xl font-semibold text-choco">Más</p><p className="text-xs text-choco/45">Opciones que usas con menos frecuencia</p></div>
          <button aria-label="Cerrar menú" onClick={onClose} className="w-10 h-10 rounded-full bg-crema flex items-center justify-center"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return <button key={item.id} onClick={() => { setTab(item.id); onClose(); }} className={"min-h-[76px] rounded-2xl border p-3 text-left flex items-center gap-3 " + (active ? "bg-choco text-crema border-choco" : "bg-crema/60 text-choco border-oro/15")}>
              <span className={"w-10 h-10 rounded-xl flex items-center justify-center shrink-0 " + (active ? "bg-white/10" : "bg-white")}><Icon size={19} /></span>
              <div className="min-w-0"><p className="text-sm font-semibold truncate">{item.label}</p>{alerts[item.id] > 0 && <p className={"text-[11px] mt-0.5 " + (active ? "text-crema/70" : "text-rosa")}>{alerts[item.id]} pendiente{alerts[item.id] === 1 ? "" : "s"}</p>}</div>
            </button>;
          })}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, alert }) {
  return (
    <button onClick={onClick}
      className={"relative min-h-10 flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap " +
        (active ? "bg-choco text-crema shadow-sm" : "bg-white text-choco/65 border border-oro/20 hover:bg-crema hover:text-choco")}
    >
      {Icon && <Icon size={16} />} {label}
      {alert > 0 && <span className="ml-0.5 bg-rosa text-white text-[10px] font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center">{alert}</span>}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={"od-card bg-white rounded-[20px] border border-oro/15 shadow-[0_1px_2px_rgba(90,52,32,0.04),0_8px_28px_rgba(90,52,32,0.035)] " + className}>{children}</div>;
}

function Badge({ children, color = "emerald" }) {
  const colors = {
    emerald: "bg-oro/20 text-choco",
    amber: "bg-caramelo/15 text-caramelo",
    red: "bg-red-50 text-red-700 border border-red-100",
    stone: "bg-choco/[0.06] text-choco/65",
  };
  return <span className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold leading-none " + colors[color]}>{children}</span>;
}

function KPI({ label, value, icon: Icon, tone = "emerald", helper }) {
  const tones = {
    emerald: "text-choco bg-oro/15",
    amber: "text-caramelo bg-caramelo/10",
    red: "text-red-700 bg-red-50",
  };
  return (
    <Card className="od-kpi p-3.5 sm:p-4 h-full min-h-[112px] sm:min-h-[118px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-choco/45 leading-tight min-h-[28px] sm:min-h-0">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-choco leading-tight mt-1 break-words">{value}</p>
        </div>
        {Icon && <div className={"w-9 h-9 rounded-xl flex items-center justify-center shrink-0 " + tones[tone]}><Icon size={18} /></div>}
      </div>
      {helper && <p className="text-[10px] sm:text-[11px] text-choco/40 mt-2 leading-snug">{helper}</p>}
    </Card>
  );
}

function TextInput(props) {
  return <input {...props} className={"od-input min-h-11 px-3.5 py-2.5 text-[15px] sm:text-sm rounded-xl border border-oro/25 bg-white text-choco placeholder:text-choco/30 transition-all focus:outline-none focus:border-caramelo focus:ring-4 focus:ring-oro/10 " + (props.className || "")} />;
}

function SelectInput(props) {
  return <select {...props} className={"od-input min-h-11 px-3.5 py-2.5 text-[15px] sm:text-sm rounded-xl border border-oro/25 bg-white text-choco transition-all focus:outline-none focus:border-caramelo focus:ring-4 focus:ring-oro/10 " + (props.className || "")} />;
}

function TextArea(props) {
  return <textarea {...props} className={"od-input px-3.5 py-2.5 text-[15px] sm:text-sm rounded-xl border border-oro/25 bg-white text-choco placeholder:text-choco/30 transition-all focus:outline-none focus:border-caramelo focus:ring-4 focus:ring-oro/10 " + (props.className || "")} />;
}

function StockBar({ stock, min }) {
  const ceiling = Math.max(asNumber(min) * 3, asNumber(min) + 1, 1);
  const ratio = Math.max(0, Math.min(1, asNumber(stock) / ceiling));
  const color = asNumber(stock) <= asNumber(min) ? "bg-red-400" : ratio < 0.6 ? "bg-caramelo" : "bg-oro";
  return <div className="w-full h-1.5 bg-crema rounded-full overflow-hidden mt-2"><div className={"h-full rounded-full transition-all " + color} style={{ width: `${ratio * 100}%` }} /></div>;
}

function Modal({ title, onClose, children, wide = false, extraWide = false }) {
  return <AccessibleDialog title={title} onClose={onClose} dismissOutside={false} wide={wide || extraWide}>{children}</AccessibleDialog>;
}

function EmptyState({ children }) {
  return <Card className="p-8 sm:p-10 text-center text-choco/40 text-sm border-dashed">{children}</Card>;
}

function Field({ label, children }) {
  const labelId = React.useId();
  const control = React.isValidElement(children) && [TextInput, SelectInput, TextArea, 'input', 'select', 'textarea'].includes(children.type)
    ? React.cloneElement(children, { 'aria-labelledby': labelId }) : children;
  return <label className="block"><span id={labelId} className="text-xs font-semibold text-choco/55 block mb-1.5">{label}</span>{control}</label>;
}

// ============================================================
// Aplicación
// ============================================================

function PublicOrderApp() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState("cart");
  const [prepLineId, setPrepLineId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(tomorrowDate());
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("Retiro");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const catalog = await fetchPublicCatalog();
        if (active) setProducts(catalog.filter((p) => p.active !== false));
      } catch (err) {
        if (active) setError(err?.message || "No pudimos cargar el catálogo.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const categories = ["Todos", ...Array.from(new Set(products.map((p) => p.category || "Otros")))];
  const visibleProducts = products.filter((product) => {
    const matchesCategory = category === "Todos" || (product.category || "Otros") === category;
    const matchesSearch = `${product.name} ${product.category || ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const cartQty = cart.reduce((sum, item) => sum + asNumber(item.qty), 0);
  const total = cart.reduce((sum, item) => sum + asNumber(item.qty) * asNumber(item.price), 0);

  function addProduct(product) {
    setCart((previous) => {
      const existing = previous.find((item) => item.productId === product.id && !cleanPrepNote(item.prepNote));
      if (existing) return previous.map((item) => item.lineId === existing.lineId ? { ...item, qty: item.qty + 1 } : item);
      return [...previous, {
        lineId: uid("line"), productId: product.id, name: product.name, price: product.price,
        category: product.category || "Otros", image: product.image || "", qty: 1, prepNote: "",
      }];
    });
  }

  function changeQty(lineId, delta) {
    setCart((previous) => previous.map((item) => item.lineId === lineId ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0));
  }

  function updatePrep(lineId, value) {
    setCart((previous) => previous.map((item) => {
      if (item.lineId !== lineId) return item;
      return isCuchufliLine(item) ? { ...item, prepNote: cleanPrepNote(value) } : { ...item, prepNote: "" };
    }));
  }

  function addVariant(item) {
    if (!isCuchufliLine(item)) return;
    const variant = { ...item, lineId: uid("line"), qty: 1, prepNote: "" };
    setCart((previous) => [...previous, variant]);
    setPrepLineId(variant.lineId);
  }

  function openCheckout() {
    setCheckoutStep("cart");
    setCheckoutOpen(true);
  }

  async function sendOrder() {
    const phoneDigits = normalizePhoneDigits(customerPhone);
    if (!cart.length || !customerName.trim() || phoneDigits.length < 8 || !deliveryDate) return;
    setSending(true);
    setError("");
    try {
      const sanitizedCart = cart.map((item) => ({ ...item, prepNote: isCuchufliLine(item) ? cleanPrepNote(item.prepNote) : "" }));
      const result = await submitPublicOrder({
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        deliveryDate, deliveryTime, deliveryMethod, notes: notes.trim(), items: sanitizedCart,
      });
      setSuccess({
        ...result,
        customerName: customerName.trim(),
        deliveryDate,
        deliveryTime,
        deliveryMethod,
        items: sanitizedCart,
        total: result?.total ?? total,
      });
      setCart([]);
      setCheckoutOpen(false);
      setCheckoutStep("cart");
    } catch (err) {
      setError(err?.message || "No pudimos enviar tu pedido.");
    } finally {
      setSending(false);
    }
  }

  if (success) {
    return <div className="od-public min-h-screen bg-[#FBF1E4] text-[#5A3420] px-4 py-8 flex items-center justify-center">
      <style>{`.od-public *{-webkit-tap-highlight-color:transparent}.od-public input,.od-public textarea{font-size:16px}`}</style>
      <div className="w-full max-w-md overflow-hidden rounded-[30px] bg-white border border-[#C9A227]/20 shadow-[0_22px_70px_rgba(90,52,32,.12)]">
        <div className="relative bg-[linear-gradient(145deg,#5A3420,#71472F)] text-[#FBF1E4] px-6 pt-7 pb-8 text-center overflow-hidden">
          <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-[#C9A227]/12" />
          <div className="absolute -left-10 bottom-0 w-28 h-28 rounded-full bg-[#D98B8B]/10" />
          <img src={logo} alt="Ojos Dulces" className="relative w-20 h-20 rounded-full object-cover mx-auto border-2 border-[#FBF1E4]/40 shadow-lg" />
          <div className="relative w-12 h-12 rounded-full bg-[#C9A227] text-[#5A3420] flex items-center justify-center mx-auto mt-4 shadow-lg"><Check size={25} strokeWidth={2.5} /></div>
          <h1 className="relative font-brand text-[32px] font-semibold mt-3">¡Pedido recibido!</h1>
          <p className="relative text-sm text-[#FBF1E4]/72 mt-1">Gracias, {success.customerName}. Te contactaremos por WhatsApp para confirmarlo.</p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[#FBF1E4]/75 p-3.5"><p className="text-[10px] uppercase tracking-[.14em] font-bold text-[#5A3420]/38">Código</p><p className="font-brand text-xl font-semibold mt-1">#{success.code || "PEDIDO"}</p></div>
            <div className="rounded-2xl bg-[#FBF1E4]/75 p-3.5"><p className="text-[10px] uppercase tracking-[.14em] font-bold text-[#5A3420]/38">Total</p><p className="text-lg font-bold text-[#C17817] mt-1">{RAW_CLP(success.total)}</p></div>
          </div>
          <div className="mt-3 rounded-2xl border border-[#C9A227]/15 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} className="text-[#C17817]" /> {fmtDeliveryDate(success.deliveryDate)}{success.deliveryTime ? ` · ${success.deliveryTime}` : ""}</div>
            <p className="text-xs text-[#5A3420]/48 mt-1.5">{success.deliveryMethod} · Pedido pendiente de confirmación.</p>
          </div>
          {success.preview && <p className="text-[11px] text-[#C17817] mt-3 text-center">Modo de prueba local: todavía no está conectado a Internet.</p>}
          <button onClick={() => setSuccess(null)} className="w-full min-h-[52px] rounded-2xl bg-[#5A3420] text-[#FBF1E4] font-semibold mt-5 shadow-[0_10px_24px_rgba(90,52,32,.14)]">Volver al catálogo</button>
        </div>
      </div>
    </div>;
  }

  return <div className="od-public min-h-screen text-[#5A3420] pb-28 bg-[#FBF1E4]">
    <style>{`
      .od-public{background-image:radial-gradient(circle at 90% 0%,rgba(201,162,39,.11),transparent 28%),radial-gradient(circle at 0% 26%,rgba(217,139,139,.10),transparent 22%)}
      .od-public input,.od-public textarea,.od-public select{font-size:16px}
      .od-public *{-webkit-tap-highlight-color:transparent}
      .od-public .hide-scrollbar::-webkit-scrollbar{display:none}
      .od-public .hide-scrollbar{scrollbar-width:none}
    `}</style>

    <div className="max-w-3xl mx-auto">
      <header className="px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="Ojos Dulces" className="w-12 h-12 rounded-full object-cover border border-[#C9A227]/25 bg-white shadow-sm" />
            <div className="min-w-0"><p className="font-brand text-[25px] font-semibold leading-none">Ojos Dulces</p><p className="text-[9px] uppercase tracking-[.2em] text-[#C17817] mt-1">Dulcería artesanal</p></div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-[#C9A227]/15 px-2.5 py-1.5 text-[10px] font-bold text-[#5A3420]/55"><Sparkles size={12} className="text-[#C17817]" /> Por encargo</span>
        </div>
      </header>

      <main className="px-4 pb-6">
        {!PUBLIC_ORDERS_CLOUD_READY && <div className="mb-4 rounded-2xl bg-[#D98B8B]/12 border border-[#D98B8B]/25 p-3 text-xs text-[#5A3420]/70"><strong>Vista previa local.</strong> Puedes probar el catálogo ahora. Para recibir pedidos desde Internet, conecta Supabase.</div>}

        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#5A3420,#6A422B)] text-[#FBF1E4] px-5 py-6 sm:px-6 sm:py-7 shadow-[0_16px_45px_rgba(90,52,32,.14)] mb-5">
          <div className="absolute -right-14 -top-14 w-40 h-40 rounded-full bg-[#C9A227]/12" />
          <div className="absolute right-8 bottom-0 w-20 h-20 rounded-full bg-[#D98B8B]/10" />
          <div className="relative max-w-[80%]"><p className="text-[10px] uppercase tracking-[.18em] font-bold text-[#E8B04B]">Pedidos Ojos Dulces</p><h1 className="font-brand text-[34px] sm:text-[38px] font-semibold leading-[.98] mt-2">Elige tus favoritos</h1><p className="text-sm text-[#FBF1E4]/68 mt-3 leading-relaxed">Arma tu encargo a tu gusto y dinos para cuándo lo necesitas.</p></div>
          <div className="relative flex items-center gap-4 mt-5 text-[10px] font-semibold text-[#FBF1E4]/70"><span className="flex items-center gap-1.5"><Check size={13} className="text-[#E8B04B]" /> Hecho artesanalmente</span><span className="flex items-center gap-1.5"><CalendarDays size={13} className="text-[#E8B04B]" /> Tú eliges la fecha</span></div>
        </section>

        <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-3.5 text-[#5A3420]/32" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="¿Qué se te antoja?" className="w-full min-h-12 rounded-2xl border border-[#C9A227]/18 bg-white/90 shadow-[0_5px_18px_rgba(90,52,32,.035)] pl-10 pr-4 outline-none focus:border-[#C17817]" /></div>
        <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-4 -mx-1 px-1">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={"shrink-0 min-h-9 px-3.5 rounded-full text-xs font-semibold border transition-colors " + (category === item ? "bg-[#5A3420] text-[#FBF1E4] border-[#5A3420] shadow-sm" : "bg-white/80 text-[#5A3420]/58 border-[#C9A227]/18")}>{item}</button>)}</div>

        {loading ? <div className="py-16 text-center"><Loader2 size={26} className="animate-spin mx-auto" /><p className="text-sm text-[#5A3420]/45 mt-2">Preparando el catálogo...</p></div> : error && !products.length ? <div className="rounded-2xl bg-white border border-red-100 p-5 text-sm text-red-600">{error}</div> : visibleProducts.length === 0 ? <div className="py-14 text-center text-sm text-[#5A3420]/45">No encontramos productos.</div> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {visibleProducts.map((product) => {
            const custom = isCuchufliLine(product);
            return <button key={product.id} onClick={() => addProduct(product)} className="group text-left rounded-[24px] bg-white border border-[#C9A227]/13 overflow-hidden shadow-[0_9px_28px_rgba(90,52,32,.055)] active:scale-[.985] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(90,52,32,.08)]">
              <div className="aspect-[1.12/1] bg-[#F7E8D6] overflow-hidden flex items-center justify-center relative">{product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" /> : <Package size={34} strokeWidth={1.2} className="text-[#5A3420]/18" />}{custom && <span className="absolute top-2 left-2 rounded-full bg-[#FBF1E4]/92 backdrop-blur px-2 py-1 text-[8px] uppercase tracking-wide font-bold text-[#C17817]">Personalizable</span>}</div>
              <div className="p-3.5"><p className="font-semibold text-sm leading-tight min-h-[36px] text-[#5A3420]">{product.name}</p><div className="flex items-center justify-between mt-2.5 gap-2"><span className="font-bold text-[#C17817]">{RAW_CLP(product.price)}</span><span className="w-8 h-8 rounded-full bg-[#C9A227]/16 text-[#5A3420] flex items-center justify-center group-active:bg-[#5A3420] group-active:text-[#FBF1E4]"><Plus size={16} /></span></div></div>
            </button>;
          })}
        </div>}
      </main>
    </div>

    {cartQty > 0 && !checkoutOpen && <button onClick={openCheckout} className="fixed z-40 left-3 right-3 max-w-xl mx-auto bottom-[calc(12px+env(safe-area-inset-bottom))] min-h-[62px] rounded-[21px] bg-[#5A3420] text-[#FBF1E4] shadow-[0_16px_38px_rgba(90,52,32,.25)] px-4 flex items-center justify-between gap-3">
      <span className="flex items-center gap-3 text-left min-w-0"><span className="w-10 h-10 rounded-[14px] bg-white/10 flex items-center justify-center shrink-0"><ShoppingCart size={18} /></span><span className="min-w-0"><span className="block text-sm font-semibold leading-tight">Tu pedido · {cartQty} {cartQty === 1 ? "producto" : "productos"}</span><span className="block text-[10px] text-[#FBF1E4]/58 mt-0.5">Revisar y completar datos</span></span></span>
      <span className="font-bold flex items-center gap-2 shrink-0">{RAW_CLP(total)} <ArrowRight size={17} /></span>
    </button>}

    {checkoutOpen && <div className="fixed inset-0 z-50 bg-[#5A3420]/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center" onClick={() => setCheckoutOpen(false)}>
      <div className="w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto bg-white rounded-t-[30px] sm:rounded-[30px] pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl rounded-t-[30px] border-b border-[#C9A227]/10 px-4 pt-2.5 pb-3">
          <div className="w-10 h-1 rounded-full bg-[#5A3420]/12 mx-auto mb-3" />
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] uppercase tracking-[.15em] font-bold text-[#C17817]">{checkoutStep === "cart" ? "Paso 1 de 2" : "Paso 2 de 2"}</p><h2 className="font-brand text-[27px] font-semibold leading-tight">{checkoutStep === "cart" ? "Revisa tu pedido" : "¿Cuándo lo necesitas?"}</h2></div>
            <button onClick={() => setCheckoutOpen(false)} className="w-10 h-10 rounded-full bg-[#FBF1E4] flex items-center justify-center shrink-0"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-3"><div className={"h-1.5 rounded-full " + (checkoutStep === "cart" || checkoutStep === "details" ? "bg-[#C9A227]" : "bg-[#5A3420]/08")} /><div className={"h-1.5 rounded-full " + (checkoutStep === "details" ? "bg-[#C9A227]" : "bg-[#5A3420]/08")} /></div>
        </div>

        {checkoutStep === "cart" ? <div className="px-4 pt-2">
          <p className="text-xs text-[#5A3420]/44 py-2">Los <strong>cuchuflíes</strong> pueden llevar preparación especial. Los alfajores se agregan tal como aparecen en el catálogo.</p>
          <div className="divide-y divide-[#C9A227]/10">{cart.map((item) => {
            const prepOpen = prepLineId === item.lineId;
            const custom = isCuchufliLine(item);
            const special = custom ? cleanPrepNote(item.prepNote) : "";
            return <div key={item.lineId} className="py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-[16px] overflow-hidden bg-[#FBF1E4] flex items-center justify-center shrink-0">{item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package size={19} className="text-[#5A3420]/18" />}</div>
                <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{item.name}</p><p className="text-xs text-[#C17817] font-semibold mt-0.5">{RAW_CLP(item.price * item.qty)}</p>{special && <span className="inline-flex mt-1 rounded-full bg-[#D98B8B]/14 px-2 py-0.5 text-[9px] font-bold text-[#5A3420]/65">{special}</span>}</div>
                <div className="flex items-center gap-1 bg-[#FBF1E4] rounded-full p-1 shrink-0"><button onClick={() => changeQty(item.lineId,-1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center"><Minus size={13} /></button><span className="w-5 text-center text-sm font-semibold">{item.qty}</span><button onClick={() => changeQty(item.lineId,1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center"><Plus size={13} /></button></div>
              </div>
              {custom && <div className="mt-2.5 ml-0 sm:ml-[68px]">
                <div className="flex items-center gap-3"><button onClick={() => setPrepLineId(prepOpen ? null : item.lineId)} className="text-[11px] font-semibold text-[#C17817]">{special ? "Cambiar cobertura" : "+ Elegir cobertura"}</button><button onClick={() => addVariant(item)} className="text-[11px] font-semibold text-[#5A3420]/38">+ Otra variante</button></div>
                {prepOpen && <div className="mt-2.5 rounded-2xl bg-[#FBF1E4]/72 border border-[#C9A227]/10 p-3"><p className="text-[10px] uppercase tracking-wide font-bold text-[#5A3420]/38 mb-2">Preparación del cuchuflí</p><div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-2">{CUCHUFLI_PREP_OPTIONS.map((option) => <button key={option} onClick={() => updatePrep(item.lineId, option)} className={"shrink-0 min-h-8 px-2.5 rounded-full text-[10px] font-semibold border " + (prepLabel(item) === option ? "bg-[#5A3420] text-[#FBF1E4] border-[#5A3420]" : "bg-white text-[#5A3420]/58 border-[#C9A227]/15")}>{option}</button>)}</div><input value={item.prepNote || ""} onChange={(e) => updatePrep(item.lineId,e.target.value)} placeholder="Ej. mitad coco, mitad chocolate" className="w-full min-h-11 rounded-xl border border-[#C9A227]/18 bg-white px-3 outline-none" /></div>}
              </div>}
            </div>;
          })}</div>

          <div className="mt-2 rounded-[20px] bg-[#FBF1E4]/70 px-4 py-3.5 flex items-center justify-between"><span><span className="block text-xs text-[#5A3420]/45">Total del pedido</span><span className="block text-[10px] text-[#5A3420]/35 mt-0.5">{cartQty} unidad{cartQty === 1 ? "" : "es"}</span></span><strong className="text-xl text-[#5A3420]">{RAW_CLP(total)}</strong></div>
          <button onClick={() => { setCheckoutStep("details"); setPrepLineId(null); }} className="w-full min-h-[52px] rounded-2xl bg-[#5A3420] text-[#FBF1E4] font-semibold mt-4 flex items-center justify-center gap-2">Continuar <ArrowRight size={16} /></button>
        </div> : <div className="px-4 pt-4 space-y-4">
          <button onClick={() => setCheckoutStep("cart")} className="text-xs font-semibold text-[#C17817]">← Volver al pedido</button>

          <section className="rounded-[20px] border border-[#C9A227]/14 p-4 space-y-3">
            <div><p className="font-brand text-xl font-semibold">Tus datos</p><p className="text-xs text-[#5A3420]/42 mt-0.5">Los usamos solo para confirmar tu encargo.</p></div>
            <div><label className="text-xs font-semibold text-[#5A3420]/55 block mb-1.5">Nombre</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre y apellido" className="w-full min-h-12 rounded-xl border border-[#C9A227]/18 px-3.5 outline-none focus:border-[#C17817]" /></div>
            <div><label className="text-xs font-semibold text-[#5A3420]/55 block mb-1.5">WhatsApp</label><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" placeholder="Ej. +56 9 1234 5678" className="w-full min-h-12 rounded-xl border border-[#C9A227]/18 px-3.5 outline-none focus:border-[#C17817]" /></div>
          </section>

          <section className="rounded-[20px] border border-[#C9A227]/14 p-4 space-y-3">
            <div><p className="font-brand text-xl font-semibold">Entrega</p><p className="text-xs text-[#5A3420]/42 mt-0.5">El horario queda sujeto a confirmación por WhatsApp.</p></div>
            <div><label className="text-xs font-semibold text-[#5A3420]/55 block mb-1.5">Fecha del encargo</label><input type="date" min={todayDate()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full min-w-0 min-h-12 rounded-xl border border-[#C9A227]/18 px-3.5 outline-none" /></div>
            <div><label className="text-xs font-semibold text-[#5A3420]/55 block mb-1.5">Hora aproximada</label><input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full min-w-0 min-h-12 rounded-xl border border-[#C9A227]/18 px-3.5 outline-none" /></div>
            <div><label className="text-xs font-semibold text-[#5A3420]/55 block mb-1.5">Cómo lo recibirás</label><div className="grid grid-cols-2 gap-2">{["Retiro","Coordinar entrega"].map((method) => <button key={method} onClick={() => setDeliveryMethod(method)} className={"min-h-11 rounded-xl border text-xs font-semibold " + (deliveryMethod === method ? "bg-[#5A3420] text-[#FBF1E4] border-[#5A3420]" : "bg-white border-[#C9A227]/18 text-[#5A3420]/58")}>{method}</button>)}</div></div>
            <div><label className="text-xs font-semibold text-[#5A3420]/55 block mb-1.5">Nota general <span className="font-normal text-[#5A3420]/35">(opcional)</span></label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Dirección, referencia u otra información del pedido" className="w-full rounded-xl border border-[#C9A227]/18 px-3.5 py-3 outline-none resize-none" /></div>
          </section>

          <div className="rounded-[20px] bg-[#FBF1E4]/72 p-4 flex justify-between items-center"><div><p className="text-xs text-[#5A3420]/45">Total a confirmar</p><p className="text-[10px] text-[#5A3420]/35 mt-0.5">El pago se coordina contigo</p></div><strong className="text-xl">{RAW_CLP(total)}</strong></div>
          {error && <p className="text-xs text-red-600 rounded-xl bg-red-50 px-3 py-2">{error}</p>}
          <button onClick={sendOrder} disabled={sending || !cart.length || !customerName.trim() || normalizePhoneDigits(customerPhone).length < 8 || !deliveryDate} className="w-full min-h-[54px] rounded-2xl bg-[#5A3420] text-[#FBF1E4] font-semibold disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(90,52,32,.13)]">{sending && <Loader2 size={16} className="animate-spin" />} Enviar pedido</button>
          <p className="text-[10px] leading-relaxed text-center text-[#5A3420]/38 px-3">Tu pedido no queda confirmado automáticamente. Ojos Dulces te contactará por WhatsApp para revisar disponibilidad y entrega.</p>
        </div>}
      </div>
    </div>}
  </div>;
}

function routePath() {
  if (typeof window === "undefined") return "/pedir";
  const clean = window.location.pathname.replace(/\/+$/, "");
  return clean || "/";
}

export default function BusinessApp() {
  const path = routePath();
  const queryPublic = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("pedir") === "1" : false;

  // El catálogo para clientes vive únicamente en /pedir.
  // Conservamos ?pedir=1 solo por compatibilidad con enlaces antiguos ya compartidos.
  if (path === '/pedir' || queryPublic) return import.meta.env.VITE_ENABLE_LEGACY_SHOP === 'true' ? <PublicOrderApp /> : <div className="min-h-screen bg-crema p-8 flex flex-col items-center justify-center text-center"><h1 className="text-2xl font-bold text-choco">Catálogo en preparación</h1><p className="mt-3 text-choco/70">Este negocio aún no habilitó los pedidos en línea.</p><a href="/" className="mt-6 underline">Volver al inicio</a></div>;

  // Cuando App.jsx renderiza BusinessApp fuera de /pedir, ya existe una sesión
  // administrativa válida y window.storage está conectado al negocio compartido.
  return <AdminBusinessApp onAdminLogout={() => {
    try { window.dispatchEvent(new Event("od-admin-signout")); } catch {}
  }} />;
}

function AdminBusinessApp({ onAdminLogout }) {
  const [profile, setProfile] = useState(() => ({ ...DEFAULT_PROFILE, name: window.businessContext?.name || 'Mi negocio' }));
  const [dataError, setDataError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [savingData, setSavingData] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [appearanceError, setAppearanceError] = useState('');
  const savingRef = useRef(false);
  const dataVersion = useRef(undefined);
  setBusinessProfile(profile);
  const readOnly = window.businessContext?.role === 'reader';


  const [settings, setSettings] = useState(() => loadDeviceSettings());
  const [tab, setTabState] = useState(() => {
    if (new URLSearchParams(window.location.search).has('billingResult')) return 'planes';
    const ui = loadDeviceSettings();
    const last = loadDeviceNavigation().tab;
    const validLast = NAV_ITEMS.some((item) => item.id === last) ? last : null;
    return ui.rememberLastView && validLast ? validLast : (ui.initialPage || "resumen");
  });
  const setTab = (next) => {
    if (next !== tab && window.__ceDrafts && !window.confirm('Hay cambios sin guardar en esta pantalla. ¿Quieres salir y descartarlos?')) return;
    setTabState(next);
  };
  const [products, setProducts] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productions, setProductions] = useState([]);
  const [movements, setMovements] = useState([]);
  const [budgets, setBudgets] = useState({});
  const productData = useMemo(() => ({ profile, products, insumos, customers, sales, expenses, quotes }), [profile, products, insumos, customers, sales, expenses, quotes]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false);
  const initialized = useRef(false);
  const [webOrders, setWebOrders] = useState([]);
  const [webOrdersLoading, setWebOrdersLoading] = useState(false);
  const [webAdminSecret, setWebAdminSecretState] = useState(() => loadWebAdminSecret());
  const [focusedWebOrderId, setFocusedWebOrderId] = useState(null);
  const [webOrderPopup, setWebOrderPopup] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [pushStatus, setPushStatus] = useState(() => {
    const support = pushSupportState();
    if (support !== "available") return support;
    return typeof Notification !== "undefined" && Notification.permission === "granted" ? "checking" : "inactive";
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const notifiedWebOrderIdsRef = useRef(loadNotifiedWebOrderIds());
  const webOrdersInitialScanRef = useRef(false);

  const setWebAdminSecret = useCallback((value) => {
    setWebAdminSecretState(value);
    saveWebAdminSecret(value);
  }, []);


  const updateSettings = useCallback((patch) => {
    const next=normalizeAppearance({...settings,...patch});
    try { saveDeviceSettings(next); setSettings(next); setAppearanceError(''); return true; }
    catch { setAppearanceError('No se pudieron guardar tus preferencias. Revisa el espacio o los permisos del navegador.'); return false; }
  }, [settings]);

  const resetSettings = () => {
    if(!window.confirm('¿Restablecer tu apariencia? Las ventas y los datos del negocio se conservan.'))return;
    if(updateSettings(DEFAULT_DEVICE_SETTINGS)){clearDeviceNavigation();setTab('resumen');}
  };
  useEffect(()=>{const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true);}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);

  useEffect(() => {
    if (settings.rememberLastView) saveDeviceNavigation({ tab });
  }, [tab, settings.rememberLastView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get("webOrder");
    if (!orderId) return;
    setFocusedWebOrderId(orderId);
    setTab("webpedidos");
    setMobileMoreOpen(false);
    url.searchParams.delete("webOrder");
    const cleanUrl = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}${url.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl || "/");
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return undefined;
    const clearBadge = () => {
      if (typeof navigator.clearAppBadge === "function") Promise.resolve(navigator.clearAppBadge()).catch(() => {});
    };
    clearBadge();
    const onVisibility = () => { if (document.visibilityState === "visible") clearBadge(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event) => setSystemDark(event.matches);
    media.addEventListener?.("change", handler);
    return () => media.removeEventListener?.("change", handler);
  }, []);

  const notify = useCallback((message, tone = "emerald") => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  function applySnapshot(data) {
    dataVersion.current = Number(data.version);
    setProducts((data.products || []).map(product => ({ laborCost: 0, otherCost: 0, wastePercent: 0, recipe: [], costing: { enabled: false, yieldQty: 1, recipe: [] }, ...product })));
    setInsumos((data.insumos || []).map(normalizeInsumoForCosting));
    setCustomers(data.customers || []);
    setSales((data.sales || []).map(sale => {
      const total = asNumber(sale.total), paid = sale.paidAmount === undefined ? total : asNumber(sale.paidAmount);
      return { discount: 0, delivery: 0, subtotal: total, orderStatus: 'Entregado', deliveryDate: '', deliveryTime: '', notes: '', cost: 0, ...sale, paidAmount: paid, balance: Math.max(0, total - paid), paymentStatus: paymentStatus(total, paid) };
    }));
    setQuotes(data.quotes || []); setExpenses(data.expenses || []);
    setSuppliers(data.suppliers || []); setProductions(data.productions || []);
    setMovements(data.movements || []); setBudgets(data.budgets || {});
    const nextProfile = { ...DEFAULT_PROFILE, name: window.businessContext?.name || 'Mi negocio', ...(data.profile || {}) };
    setProfile(nextProfile); setBusinessProfile(nextProfile);
    document.title = `${nextProfile.name} · Control Emprende`;
  }
  const loadAll = useCallback(async (force = false) => {
    if (savingRef.current) return;
    setSyncing(true);
    try {
      const data = await window.storage.getSnapshot(force);
      if (savingRef.current) return;
      applySnapshot(data); setDataError(''); setOperationError('');
    } catch (error) { setDataError(error.message || 'No fue posible abrir los datos.'); reportDiagnostic('LOAD_FAILED'); }
    finally { setLoading(false); setSyncing(false); }
  }, []);
  useEffect(() => {
    loadAll(false);
    const refresh = () => { if (!savingRef.current && !window.__ceDrafts && !document.querySelector('[aria-modal="true"]')) loadAll(true); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('cloud-storage-updated', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
    return () => { window.clearInterval(interval); window.removeEventListener('cloud-storage-updated', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [loadAll]);

  const openWebOrder = useCallback((order) => {
    if (!order) return;
    setFocusedWebOrderId(order.id);
    setTab("webpedidos");
    setMobileMoreOpen(false);
    setWebOrderPopup(null);
  }, []);

  const announceWebOrder = useCallback((order) => {
    const code = order.public_code || String(order.id || "").slice(-6).toUpperCase();
    const message = `${order.customer_name || "Cliente"} · ${CLP(order.total)}${order.delivery_date ? ` · ${fmtDeliveryDate(order.delivery_date)}` : ""}`;
    setWebOrderPopup({ order, title: `Nuevo pedido #${code}`, message });
    try {
      if (navigator.vibrate) navigator.vibrate([80, 45, 80]);
    } catch {}
    if (pushStatus !== "active" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const browserNotification = new Notification(`Ojos Dulces · Nuevo pedido #${code}`, {
          body: message,
          icon: logo,
          tag: `od-order-${order.id}`,
        });
        browserNotification.onclick = () => {
          try { window.focus(); } catch {}
          openWebOrder(order);
          browserNotification.close();
        };
      } catch {}
    }
  }, [openWebOrder, pushStatus]);

  const processIncomingWebOrders = useCallback((rows) => {
    const pendingRows = (Array.isArray(rows) ? rows : []).filter((order) => !order.local_sale_id && !["Importado", "Cancelado"].includes(order.status));
    const seen = notifiedWebOrderIdsRef.current;
    if (!webOrdersInitialScanRef.current && seen.size === 0) {
      pendingRows.forEach((order) => seen.add(String(order.id)));
      saveNotifiedWebOrderIds(seen);
      webOrdersInitialScanRef.current = true;
      return;
    }
    const fresh = pendingRows.filter((order) => !seen.has(String(order.id))).sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    fresh.forEach((order) => {
      seen.add(String(order.id));
      announceWebOrder(order);
    });
    if (fresh.length) saveNotifiedWebOrderIds(seen);
    webOrdersInitialScanRef.current = true;
  }, [announceWebOrder]);

  const inspectPushSubscription = useCallback(async (syncServer = true) => {
    const support = pushSupportState();
    if (support !== "available") {
      setPushStatus(support);
      setNotificationPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      return support;
    }

    setNotificationPermission(Notification.permission);
    if (Notification.permission !== "granted") {
      setPushStatus(Notification.permission === "denied" ? "denied" : "inactive");
      return Notification.permission === "denied" ? "denied" : "inactive";
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setPushStatus("inactive");
        return "inactive";
      }
      if (syncServer && webAdminSecret) await registerAdminPushSubscription(webAdminSecret, subscription);
      setPushError("");
      setPushStatus("active");
      return "active";
    } catch (error) {
      console.error("Estado Web Push", error);
      setPushError(error?.message || "No fue posible comprobar las notificaciones push.");
      setPushStatus("error");
      return "error";
    }
  }, [webAdminSecret]);

  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_LEGACY_SHOP === 'true' && webAdminSecret && !window.businessContext?.demo) inspectPushSubscription(true);
  }, [inspectPushSubscription, webAdminSecret]);

  const requestOrderNotifications = useCallback(async () => {
    const support = pushSupportState();
    if (support === "needs-install") {
      setPushStatus("needs-install");
      notify("En iPhone, primero agrega Ojos Dulces a la pantalla de inicio. Luego ábrela desde su ícono y activa las notificaciones.", "amber");
      return "needs-install";
    }
    if (support === "unsupported") {
      setPushStatus("unsupported");
      setNotificationPermission("unsupported");
      notify("Este dispositivo no permite Web Push.", "amber");
      return "unsupported";
    }
    if (!webAdminSecret) {
      notify("Primero guarda la clave privada de Pedidos web para registrar este dispositivo.", "amber");
      return "missing-secret";
    }

    setPushBusy(true);
    setPushError("");
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "denied" : "inactive");
        notify("No se habilitaron las notificaciones del sistema.", "amber");
        return permission;
      }

      const registration = await navigator.serviceWorker.ready;
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY),
        });
      }
      await registerAdminPushSubscription(webAdminSecret, subscription);
      setPushStatus("active");
      notify("Notificaciones push activadas. Te avisaremos aunque Ojos Dulces esté cerrada.");
      return "active";
    } catch (error) {
      console.error("Activar Web Push", error);
      const message = error?.message || "No fue posible activar las notificaciones push.";
      setPushError(message);
      setPushStatus("error");
      notify(message, "red");
      return "error";
    } finally {
      setPushBusy(false);
    }
  }, [notify, webAdminSecret]);

  const disableOrderNotifications = useCallback(async () => {
    setPushBusy(true);
    setPushError("");
    try {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration("/") || await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription?.();
      const endpoint = subscription?.endpoint || "";
      if (endpoint && webAdminSecret) {
        try { await unregisterAdminPushSubscription(webAdminSecret, endpoint); } catch (error) { console.warn("No se pudo borrar la suscripción del servidor", error); }
      }
      if (subscription) await subscription.unsubscribe();
      setPushStatus(Notification.permission === "denied" ? "denied" : "inactive");
      notify("Notificaciones push desactivadas en este dispositivo.", "amber");
    } catch (error) {
      const message = error?.message || "No fue posible desactivar las notificaciones.";
      setPushError(message);
      notify(message, "red");
    } finally {
      setPushBusy(false);
    }
  }, [notify, webAdminSecret]);

  const refreshWebOrders = useCallback(async (secretOverride = null) => {
    const secret = secretOverride === null ? webAdminSecret : secretOverride;
    if (PUBLIC_ORDERS_CLOUD_READY && !secret) {
      setWebOrders([]);
      return [];
    }
    setWebOrdersLoading(true);
    try {
      const rows = await fetchAdminWebOrders(secret);
      const normalizedRows = Array.isArray(rows) ? rows : [];
      setWebOrders(normalizedRows);
      processIncomingWebOrders(normalizedRows);
      return normalizedRows;
    } catch (error) {
      console.error("Pedidos web", error);
      return [];
    } finally {
      setWebOrdersLoading(false);
    }
  }, [webAdminSecret, processIncomingWebOrders]);

  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_LEGACY_SHOP !== 'true' || !webAdminSecret || window.businessContext?.demo) return undefined;
    refreshWebOrders();
    const interval = window.setInterval(() => refreshWebOrders(), 20000);
    return () => window.clearInterval(interval);
  }, [refreshWebOrders, webAdminSecret]);

  async function persistBatch(patch, action = 'edit', operationId) {
    if (savingRef.current) return false;
    if (readOnly) { notify('Tu acceso es de solo lectura.', 'red'); return false; }
    savingRef.current = true; setSavingData(true); setOperationError('');
    try {
      const data = await window.storage.setMany(patch, { expectedVersion: dataVersion.current, action, ...(operationId ? { operationId } : {}) });
      applySnapshot(data);
      return true;
    } catch (error) {
      reportDiagnostic('SAVE_FAILED');
      setOperationError(error.message || 'No fue posible guardar.');
      notify(error.message || 'No fue posible guardar.', 'red');
      return false;
    } finally { savingRef.current = false; setSavingData(false); }
  }
  async function persist(setter, key, next) { return persistBatch({ [KEY_TO_COLUMN[key]]: next }); }
  const persistProducts = (next) => persist(setProducts, STORAGE_KEYS.products, next);
  const persistInsumos = (next) => persist(setInsumos, STORAGE_KEYS.insumos, next);
  const persistCustomers = (next) => persist(setCustomers, STORAGE_KEYS.customers, next);
  const persistSales = (next) => persist(setSales, STORAGE_KEYS.sales, next);
  const persistQuotes = (next) => persist(setQuotes, STORAGE_KEYS.quotes, next);
  const persistExpenses = (next) => persist(setExpenses, STORAGE_KEYS.expenses, next);
  const persistSuppliers = (next) => persist(setSuppliers, STORAGE_KEYS.suppliers, next);
  const persistProductions = (next) => persist(setProductions, STORAGE_KEYS.productions, next);
  const persistMovements = (next) => persist(setMovements, STORAGE_KEYS.movements, next);
  const persistBudgets = (next) => persist(setBudgets, STORAGE_KEYS.budgets, next);

  function resolveCustomer({ customerMode, selectedCustomerId, newCustName, newCustPhone }) {
    if (customerMode === "existente" && selectedCustomerId) {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (customer) return { customerId: customer.id, customerName: customer.name, nextCustomers: customers };
    }
    if (customerMode === "nuevo" && newCustName.trim()) {
      const newCustomer = { id: uid("cli"), name: newCustName.trim(), phone: newCustPhone.trim(), notes: "", createdAt: todayISO() };
      return { customerId: newCustomer.id, customerName: newCustomer.name, nextCustomers: [...customers, newCustomer] };
    }
    return { customerId: null, customerName: "Cliente ocasional", nextCustomers: customers };
  }

  async function createSale(payload, sourceQuoteId = null) {
    try {
      const existing = sales.find(sale => (payload.operationId && sale.id === `venta_${payload.operationId}`) || (payload.externalOrderId && sale.externalOrderId === payload.externalOrderId) || (sourceQuoteId && sale.quoteId === sourceQuoteId));
      if (existing) { notify('Esta venta ya estaba registrada.'); return existing; }
      if (!payload.cart?.length) throw new Error('Agrega al menos un producto.');
      const customer = resolveCustomer(payload);
      const pricedItems = payload.cart.map(item => {
        finiteNumber(item.qty, 'Cantidad', { positive: true }); finiteNumber(item.price, 'Precio');
        const product = products.find(p => p.id === item.productId);
        if (!product || product.active === false) throw new Error('Revisa los productos de la venta. Uno ya no está disponible.');
        const breakdown = productCostBreakdown(product, insumos);
        return { ...item, unitCost: breakdown.total, costKnown: breakdown.missingCosts.length === 0 && breakdown.total > 0, costSnapshot: { ...breakdown, capturedAt: todayISO() } };
      });
      const discount = finiteNumber(payload.discount || 0, 'Descuento'), delivery = finiteNumber(payload.delivery || 0, 'Despacho');
      const { subtotal, total: rawTotal } = totalsFromItems(pricedItems, discount, delivery);
      if (discount > subtotal) throw new Error('El descuento no puede superar el subtotal.');
      const total = roundMoney(rawTotal), paidAmount = finiteNumber(payload.paidAmount || 0, 'Pago');
      if (paidAmount > total) throw new Error('El pago no puede superar el total.');
      const dateISO = todayISO(), id = payload.operationId ? `venta_${payload.operationId}` : uid('venta');
      const inventory = saleInventory(products, pricedItems, { automatic: profile.inventoryMode === 'automatic', referenceId: id, dateISO });
      const sale = {
        id, dateISO, customerId: customer.customerId, customerName: customer.customerName, items: pricedItems,
        subtotal, discount, delivery, total, paidAmount, balance: roundMoney(total - paidAmount), paymentStatus: paymentStatus(total, paidAmount),
        payments: paidAmount > 0 ? [{ id: uid('pago'), dateISO, amount: paidAmount, method: payload.payment || 'Transferencia' }] : [],
        paymentMethod: payload.payment || 'Transferencia', orderStatus: payload.orderStatus || 'Pendiente', deliveryDate: payload.deliveryDate || '', deliveryTime: payload.deliveryTime || '', notes: payload.notes || '',
        cost: roundMoney(pricedItems.reduce((sum, item) => sum + item.unitCost * item.qty, 0)), costKnown: pricedItems.every(item => item.costKnown), paymentDueDate: payload.paymentDueDate || '', quoteId: sourceQuoteId,
        source: payload.source || 'manual', externalOrderId: payload.externalOrderId || null, stockControlApplied: profile.inventoryMode === 'automatic',
      };
      const patch = { sales: [sale, ...sales] };
      if (customer.nextCustomers !== customers) patch.customers = customer.nextCustomers;
      if (profile.inventoryMode === 'automatic') { patch.products = inventory.products; patch.movements = [...inventory.movements, ...movements]; }
      if (sourceQuoteId) patch.quotes = quotes.map(q => q.id === sourceQuoteId ? { ...q, status: 'Aceptado', convertedSaleId: id } : q);
      if (!await persistBatch(patch, 'sale.create', payload.operationId)) return false;
      notify('Venta registrada correctamente.'); return sale;
    } catch (error) { notify(error.message, 'red'); return false; }
  }
  async function handleDeleteSale(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return false;
    try {
      const patch = { sales: sales.filter(s => s.id !== saleId) };
      if (sale.stockControlApplied !== false) {
        const inventory = saleInventory(products, sale.items, { automatic: true, reverse: true, referenceId: sale.id });
        patch.products = inventory.products; patch.movements = [...inventory.movements, ...movements];
      }
      if (sale.quoteId) patch.quotes = quotes.map(q => q.id === sale.quoteId ? { ...q, convertedSaleId: null, status: 'Borrador' } : q);
      if (!await persistBatch(patch, 'sale.delete')) return false;
      notify('Venta eliminada y registros asociados actualizados.', 'amber'); return true;
    } catch (error) { notify(error.message, 'red'); return false; }
  }
  async function handleProduce(productId, qty) {
    try {
      const product = products.find(p => p.id === productId);
      const result = productionInventory(products, insumos, productId, qty, productUnitCost(product, insumos));
      if (!await persistBatch({ products: result.products, insumos: result.insumos, productions: [result.production, ...productions], movements: [...result.movements, ...movements] }, 'production.create')) return false;
      notify('Producción registrada e inventario actualizado.'); return true;
    } catch (error) { notify(error.message, 'red'); return false; }
  }
  async function handleInventoryAdjustment({ entityType, entityId, delta, reason }) {
    try {
      const quantity = Number(delta);
      if (!Number.isFinite(quantity) || !quantity || !reason?.trim()) throw new Error('Indica una cantidad y el motivo del ajuste.');
      const key = entityType === 'producto' ? 'products' : 'insumos', collection = key === 'products' ? products : insumos;
      const item = collection.find(i => i.id === entityId);
      if (!item || asNumber(item.stock) + quantity < 0) throw new Error('El ajuste dejaría el stock en negativo.');
      const movement = { id: uid('mov'), dateISO: todayISO(), type: quantity < 0 ? 'Merma' : 'Ajuste positivo', entityType, entityId, name: item.name, qty: quantity, unit: item.unit || 'unid', referenceId: uid('ajuste'), note: reason.trim() };
      if (!await persistBatch({ [key]: collection.map(i => i.id === entityId ? { ...i, stock: asNumber(i.stock) + quantity } : i), movements: [movement, ...movements] }, 'inventory.adjust')) return false;
      notify('Ajuste e historial de inventario guardados.'); return true;
    } catch (error) { notify(error.message, 'red'); return false; }
  }
  async function addExpense(expense, purchaseLines = []) {
    try {
      const dateISO = expense.date ? new Date(`${expense.date}T12:00:00`).toISOString() : todayISO();
      const total = finiteNumber(purchaseLines.length ? purchaseLines.reduce((sum, line) => sum + Number(line.totalPrice ?? line.qty * line.unitCost), 0) : expense.total, 'Total', { positive: true });
      const normalized = { id: uid('gasto'), dateISO, type: purchaseLines.length ? 'Compra' : 'Gasto', category: expense.category || (purchaseLines.length ? 'Insumos' : 'Otros'), supplierId: expense.supplierId || null, supplierName: suppliers.find(s => s.id === expense.supplierId)?.name || expense.supplierName || 'Sin proveedor', description: expense.description || (purchaseLines.length ? 'Compra de insumos' : 'Gasto general'), total: roundMoney(total), paymentMethod: expense.paymentMethod || 'Transferencia', documentNumber: expense.documentNumber || '', paymentStatus: expense.paymentStatus || 'Pagado', items: purchaseLines };
      if (normalized.paymentStatus === 'Pagado') normalized.paidAt = dateISO;
      const patch = { expenses: [normalized, ...expenses] };
      if (purchaseLines.length) { const result = purchaseInventory(insumos, purchaseLines, normalized.id, dateISO); patch.insumos = result.insumos; patch.movements = [...result.movements, ...movements]; }
      if (!await persistBatch(patch, purchaseLines.length ? 'purchase.create' : 'expense.create')) return false;
      notify(purchaseLines.length ? 'Compra registrada y stock actualizado.' : 'Gasto registrado.'); return true;
    } catch (error) { notify(error.message, 'red'); return false; }
  }

  async function registerInsumoPurchase({ insumoId, purchaseQty, purchaseUnit, totalPrice, date, note }) {
    const insumo = insumos.find((item) => item.id === insumoId);
    if (!insumo) return false;
    const baseUnit = canonicalBaseUnit(insumo.unit);
    const baseQty = convertPurchaseToBase(purchaseQty, purchaseUnit, baseUnit);
    const total = asNumber(totalPrice);
    if (baseQty <= 0 || total <= 0) {
      notify("Completa una cantidad y un precio de compra válidos.", "red");
      return false;
    }
    const unitCost = total / baseQty;
    return addExpense({
      date: date || todayDate(), category: "Insumos", description: `Compra de ${insumo.name}`,
      paymentMethod: "Transferencia", paymentStatus: "Pagado", documentNumber: "", supplierId: "", supplierName: "",
    }, [{ insumoId, qty: baseQty, unitCost, purchaseQty: asNumber(purchaseQty), purchaseUnit, totalPrice: total, note: note || "" }]);
  }

  async function deleteExpense(expenseId) {
    const expense = expenses.find(item => item.id === expenseId);
    if (!expense) return false;
    if (expense.type === 'Compra') { notify('Para corregir una compra, registra un ajuste de inventario.', 'red'); return false; }
    if (!await persistBatch({ expenses: expenses.filter(item => item.id !== expenseId) }, 'expense.delete')) return false;
    notify('Gasto eliminado.', 'amber'); return true;
  }
  async function markExpensePaid(expenseId) {
    const current = expenses.find(e => e.id === expenseId);
    if (!current || current.paymentStatus === 'Pagado') return false;
    const ok = await persistBatch({ expenses: expenses.map(e => e.id === expenseId ? { ...e, paymentStatus: 'Pagado', paidAt: todayISO() } : e) }, 'expense.pay');
    if (ok) notify('Pago del gasto registrado con fecha de hoy.');
    return ok;
  }
  async function updateSale(saleId, patch) {
    try {
      const current = sales.find(s => s.id === saleId);
      if (!current) return false;
      const discount = finiteNumber(patch.discount ?? current.discount ?? 0, 'Descuento'), delivery = finiteNumber(patch.delivery ?? current.delivery ?? 0, 'Despacho');
      const subtotal = current.subtotal ?? current.items.reduce((sum,item) => sum + item.price * item.qty, 0);
      if(discount > subtotal) throw new Error('El descuento no puede superar el subtotal.');
      const total = roundMoney(subtotal - discount + delivery);
      const paid = finiteNumber(patch.paidAmount ?? current.paidAmount, 'Pago');
      if (paid > total) throw new Error('El pago no puede superar el total.');
      const delta = roundMoney(paid - current.paidAmount);
      const payments = current.payments || [];
      const next = sales.map(sale => sale.id !== saleId ? sale : { ...sale, ...patch, discount, delivery, total, paidAmount: paid, balance: roundMoney(total - paid), paymentStatus: paymentStatus(total, paid), ...(delta ? { legacyPaidAmount: sale.legacyPaidAmount ?? (Array.isArray(sale.payments) ? 0 : sale.paidAmount), payments: [...payments, { id: uid('pago'), dateISO: todayISO(), amount: delta, method: patch.paymentMethod || sale.paymentMethod, note: delta < 0 ? 'Corrección de pago' : 'Abono' }] } : {}) });
      if (!await persistBatch({ sales: next }, delta ? 'payment.record' : 'order.update')) return false;
      notify('Pedido actualizado.'); return true;
    } catch (error) { notify(error.message, 'red'); return false; }
  }
  async function saveQuote(quoteData) {
    try {
      const customer = resolveCustomer(quoteData);
      const { subtotal, total } = totalsFromItems(quoteData.items, quoteData.discount, quoteData.delivery);
      if (!quoteData.items?.length || asNumber(quoteData.discount) > subtotal) throw new Error('Revisa los productos y el descuento.');
      const quote = { id: quoteData.id || uid('cot'), dateISO: quoteData.dateISO || todayISO(), validUntil: quoteData.validUntil || todayDate(), customerId: customer.customerId, customerName: customer.customerName, items: quoteData.items, subtotal, discount: asNumber(quoteData.discount), delivery: asNumber(quoteData.delivery), total, status: quoteData.status || 'Borrador', notes: quoteData.notes || '', convertedSaleId: quoteData.convertedSaleId || null };
      const patch = { quotes: quoteData.id ? quotes.map(q => q.id === quote.id ? quote : q) : [quote, ...quotes] };
      if (customer.nextCustomers !== customers) patch.customers = customer.nextCustomers;
      if (!await persistBatch(patch, 'quote.save')) return false;
      notify('Cotización guardada.'); return quote;
    } catch (error) { notify(error.message, 'red'); return false; }
  }
  async function convertQuoteToSale(quote) {
    return createSale({ cart: quote.items, customerMode: quote.customerId ? 'existente' : 'ocasional', selectedCustomerId: quote.customerId || '', newCustName: '', newCustPhone: '', discount: quote.discount, delivery: quote.delivery, paidAmount: 0, payment: 'Transferencia', orderStatus: 'Pendiente', notes: `Originada en cotización ${quote.id}` }, quote.id);
  }
  async function exportBackup(prefix = 'respaldo') {
    const backup = { version: 3, exportedAt: todayISO(), business: { id: window.businessContext?.id, name: profile.name, currency: profile.currency }, data: { products, insumos, customers, sales, quotes, expenses, suppliers, productions, movements, budgets, profile } };
    downloadBlob(`${prefix}_${todayDate()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;');
    if (prefix === 'respaldo') notify('Respaldo descargado.');
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      if (window.businessContext?.role !== 'owner') throw new Error('Solo el propietario puede restaurar un respaldo.');
      if (file.size > 20 * 1024 * 1024) throw new Error('El respaldo supera el límite de 20 MB.');
      const parsed = JSON.parse(await file.text()), data = validateBackup(parsed);
      if ((parsed.business?.currency || data.profile?.currency || 'CLP') !== profile.currency) throw new Error('El respaldo usa otra moneda. Configura esa moneda en un negocio vacío antes de restaurarlo.');
      const counts = `${data.products.length} productos, ${data.sales.length} ventas y ${data.customers.length} clientes`;
      if (!window.confirm(`Restaurar ${counts} en ${profile.name}. Esto reemplazará los registros actuales. Primero se descargará una copia de seguridad. ¿Continuar?`)) return;
      await exportBackup('antes_de_restaurar');
      if (!data.profile?.name) data.profile = profile;
      if (!await persistBatch(data, 'backup.restore')) return;
      notify('Respaldo restaurado completamente.');
    } catch (error) { notify(error.message || 'El archivo no es un respaldo válido.', 'red'); }
  }

  async function handlePublishPublicCatalog() {
    try {
      const result = await publishPublicCatalog(products, webAdminSecret);
      if (result?.preview) notify("Vista previa lista. Conecta Supabase para publicar el catálogo en Internet.", "amber");
      else notify("Catálogo público actualizado.");
      return true;
    } catch (error) {
      notify(error?.message || "No fue posible publicar el catálogo.", "red");
      return false;
    }
  }

  async function handleImportWebOrder(order) {
    if (!order || order.local_sale_id || order.status === "Importado") return false;
    const customerMatch = findExistingCustomerMatch(customers, {
      name: order.customer_name,
      phone: order.customer_phone,
    });
    const existing = customerMatch?.customer || null;

    // Si reconocimos al cliente por nombre y antes no tenía teléfono, completamos ese dato
    // sin tocar sus notas, Club, historial ni otras preferencias guardadas.
    if (existing && !normalizePhoneDigits(existing.phone) && normalizePhoneDigits(order.customer_phone)) {
      { if (await persistCustomers(customers.map((customer) => customer.id === existing.id
        ? { ...customer, phone: order.customer_phone }
        : customer)) === false) return false; }
    }

    const cart = (order.items || []).map((item, index) => {
      const productId = item.productId || item.product_id || "";
      const product = products.find((entry) => entry.id === productId);
      const normalized = {
        lineId: item.lineId || `webline_${index}_${order.id}`,
        productId,
        name: item.name || product?.name || "Producto",
        category: item.category || product?.category || "",
        price: asNumber(item.price),
        qty: Math.max(1, asNumber(item.qty)),
        prepNote: "",
      };
      return { ...normalized, prepNote: isCuchufliLine(normalized) ? cleanPrepNote(item.prepNote || item.prep_note) : "" };
    });
    if (!cart.length) {
      notify("Este pedido web no tiene productos válidos.", "red");
      return false;
    }
    const result = await createSale({
      cart,
      customerMode: existing ? "existente" : "nuevo",
      selectedCustomerId: existing?.id || "",
      newCustName: existing ? "" : (order.customer_name || "Cliente web"),
      newCustPhone: existing ? "" : (order.customer_phone || ""),
      discount: 0,
      delivery: 0,
      paidAmount: 0,
      payment: "Transferencia",
      orderStatus: "Pendiente",
      deliveryDate: order.delivery_date || "",
      deliveryTime: order.delivery_time ? String(order.delivery_time).slice(0,5) : "",
      notes: [
        `Pedido web #${order.public_code || String(order.id || "").slice(-6)}`,
        order.delivery_method ? `Modalidad: ${order.delivery_method}` : null,
        order.notes || null,
      ].filter(Boolean).join(" · "),
      source: "web",
      externalOrderId: order.id,
    });
    if (!result) return false;
    try {
      await markAdminWebOrder(order.id, "Importado", result.id, webAdminSecret);
      await refreshWebOrders();
    } catch (error) {
      console.error(error);
      notify("El pedido se guardó, pero no pudimos marcarlo como importado en la web.", "amber");
      return result;
    }
    notify(existing
      ? `Pedido agregado a ${existing.name}. Su historial seguirá acumulándose en el mismo cliente.`
      : "Pedido web agregado a Pedidos y cliente nuevo creado.");
    setTab("pedidos");
    return result;
  }

  async function handleRejectWebOrder(order) {
    if (!order) return false;
    try {
      await markAdminWebOrder(order.id, "Cancelado", null, webAdminSecret);
      await refreshWebOrders();
      notify("Pedido web rechazado.", "amber");
      return true;
    } catch (error) {
      notify(error?.message || "No fue posible rechazar el pedido.", "red");
      return false;
    }
  }

  async function handleDeleteWebOrder(order) {
    if (!order) return false;
    try {
      await deleteAdminWebOrder(order.id, webAdminSecret);
      setWebOrders((current) => current.filter((item) => item.id !== order.id));
      if (focusedWebOrderId === order.id) setFocusedWebOrderId(null);
      notify("Pedido web eliminado.", "amber");
      return true;
    } catch (error) {
      notify(error?.message || "No fue posible eliminar el pedido web.", "red");
      return false;
    }
  }

  const lowStockProducts = products.filter((p) => p.active !== false && asNumber(p.stock) <= asNumber(p.minStock));
  const lowStockInsumos = insumos.filter((i) => i.active !== false && asNumber(i.stock) <= asNumber(i.minStock));
  const pendingOrders = sales.filter((s) => s.orderStatus !== "Entregado").length;
  const pendingQuotes = quotes.filter((q) => ["Borrador", "Enviado"].includes(q.status)).length;
  const receivables = sales.reduce((sum, sale) => sum + asNumber(sale.balance), 0);

  const effectiveDark = settings.theme === "dark" || (settings.theme === "system" && systemDark);
  MASK_SCREEN_AMOUNTS = Boolean(settings.hideAmounts);

  if (loading) {
    return <div className={"od-app min-h-[500px] flex items-center justify-center bg-crema " + (effectiveDark ? "od-dark" : "")}><div className="flex flex-col items-center gap-3 text-choco"><Loader2 className="animate-spin" size={28} /><p className="text-sm">Cargando datos...</p></div></div>;
  }

  const alerts = {
    resumen: 0,
    venta: 0,
    cotizaciones: pendingQuotes,
    pedidos: pendingOrders + (receivables > 0 ? 1 : 0),
    webpedidos: webOrders.filter((order) => !order.local_sale_id && !["Importado", "Cancelado"].includes(order.status)).length,
    clientes: 0,
    finanzas: 0,
    costos: 0,
    historial: 0,
    configuracion: 0,
  };
  const [pageTitle, pageDescription] = PAGE_META[tab] || PAGE_META.resumen;

  return (
    <div style={appearanceTokens(settings,effectiveDark)} className={`ce-v4 od-app min-h-screen bg-crema text-choco pb-20 lg:pb-0 od-palette-${settings.palette} od-density-${settings.density} od-text-${settings.textSize} ${effectiveDark ? "od-dark" : ""} ${settings.reduceMotion ? "od-reduce-motion" : ""}`}>
      {notice && <div role="status" aria-live="polite" className={`fixed left-3 right-3 top-[82px] sm:left-auto sm:right-4 sm:top-4 sm:bottom-auto z-[70] sm:max-w-sm px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold ${notice.tone === "red" ? "bg-red-600 text-white" : notice.tone === "amber" ? "bg-caramelo text-white" : "bg-choco text-crema"}`}>{notice.message}</div>}
      {webOrderPopup && <button onClick={() => openWebOrder(webOrderPopup.order)} className="fixed left-3 right-3 top-[82px] sm:left-auto sm:right-4 sm:top-4 z-[75] sm:w-[360px] rounded-2xl border border-oro/25 bg-white p-3.5 shadow-2xl text-left flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-oro/18 text-choco flex items-center justify-center shrink-0"><Bell size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-choco">{webOrderPopup.title}</span><span className="block text-xs text-choco/50 mt-0.5 truncate">{webOrderPopup.message}</span><span className="block text-[10px] font-semibold text-caramelo mt-1">Toca para revisar y confirmar</span></span><ArrowRight size={17} className="text-caramelo shrink-0" /></button>}

      <header className="od-topbar workspace-topbar">
        <div className="workspace-business"><WorkspaceMark settings={settings} profile={profile}/><div><span className="workspace-label">MI ESPACIO DE TRABAJO</span><h1>{settings.workspaceName||profile.name}</h1></div></div>
        <div className="workspace-tools"><button className="workspace-search" aria-label="Buscar en el negocio" onClick={()=>setSearchOpen(true)}><Search size={17}/><span>Buscar en mi negocio</span><kbd>⌘ / Ctrl K</kbd></button><button className="workspace-icon" onClick={()=>updateSettings({hideAmounts:!settings.hideAmounts})} aria-label={settings.hideAmounts?'Mostrar montos':'Ocultar montos'} title={settings.hideAmounts?'Mostrar montos':'Ocultar montos'}>{settings.hideAmounts?<EyeOff size={18}/>:<Eye size={18}/>}</button><button className="workspace-icon theme-switch" onClick={()=>updateSettings({theme:effectiveDark?'light':'dark'})} aria-label={effectiveDark?'Activar modo claro':'Activar modo oscuro'}>{effectiveDark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="workspace-personalize" onClick={()=>setStudioOpen(true)} aria-label="Personalizar mi espacio"><Palette size={17}/><span>Hazlo tuyo</span></button>{!window.businessContext?.local&&<button className="workspace-icon workspace-signout" aria-label="Cerrar sesión" onClick={onAdminLogout}><LogOut size={17}/></button>}</div>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar hidden lg:block"><div className="ce-sidebar"><div className="workspace-brand"><span><TrendingUp size={23}/></span><div>Control<strong>Emprende</strong></div></div><button className="workspace-new-sale" onClick={()=>setTab('venta')}><Plus size={18}/>Nueva venta<ArrowRight size={15}/></button><DesktopNav tab={tab} setTab={setTab} alerts={alerts}/><div className="workspace-sidebar-footer"><span className="workspace-live-dot"/><div><strong>{savingData?'Guardando…':syncing?'Actualizando…':'Tu espacio de trabajo'}</strong><small>Una decisión a la vez.</small></div></div></div></aside>

        <main className="od-main min-w-0 py-4 sm:py-6"><div className="workspace-page-content" key={tab}>
          <div className="od-page-heading mb-4 sm:mb-5"><div className="workspace-breadcrumb"><span>Mi espacio</span><span>/</span><span>{NAV_ITEMS.find(x=>x.id===tab)?.label||pageTitle}</span><span className="workspace-date">{new Date().toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',timeZone:profile.timezone||'America/Santiago'})}</span></div>
            <h2 className="od-page-title text-[27px] sm:text-3xl font-bold leading-tight text-choco">{pageTitle}</h2>
            <p className="od-page-description text-xs sm:text-sm text-choco/45 mt-1 max-w-2xl">{pageDescription}</p>
          </div>

          {appearanceError && <p role="alert" className="ce-error">{appearanceError}</p>}
          {dataError && <div role="alert" className="mb-4 rounded-2xl bg-red-50 text-red-800 border border-red-200 p-4">{dataError}<button className="ml-3 underline font-semibold" onClick={() => loadAll(true)}>Reintentar</button></div>}
          {operationError && <div role="alert" className="mb-4 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 p-4">{operationError}<button className="ml-3 underline font-semibold" onClick={() => loadAll(true)}>Actualizar datos</button></div>}
          {readOnly && <p className="mb-4 rounded-xl bg-crema p-3 text-sm">Acceso de consulta. Puedes revisar y exportar; para editar necesitas un acceso vigente o permiso del propietario.</p>}
          {!dataError && <>
          {tab === 'resumen' && !profile.onboardingComplete && !sales.length && !products.length && window.businessContext?.role === 'owner' && <div className="mb-5"><Onboarding profile={profile} onSave={next=>persistBatch({profile:next}, 'onboarding.complete')} goTo={setTab}/></div>}
          {tab === 'resumen' && <CommandCenter data={productData} settings={settings} money={CLP} onPersonalize={()=>setStudioOpen(true)} goTo={target=>{if(target==='gasto'){saveDeviceNavigation({finanzasSub:'gastos'});setTab('finanzas');}else setTab(target);}}/>}
          {tab === 'pagina' && <CatalogManager profile={profile} products={products} goTo={setTab}/>}
          {tab === 'negocio' && <BusinessProfilePanel profile={profile} lockedCurrency={Boolean(products.length || sales.length || expenses.length)} canEdit={window.businessContext?.role === 'owner'} onSave={async next => { const ok = await persistBatch({ profile: next }, 'profile.update'); if (ok) notify('Configuración del negocio guardada.'); return ok; }} />}
          {tab === 'guia' && <SupportPanel goTo={setTab} />}
          {tab === 'asesor' && <AdvisorPanel data={productData} money={CLP} goTo={setTab} />}
          {tab === 'informes' && <ReportsPanel data={productData} money={CLP} />}
          {tab === 'preferencias' && <PreferencesPanel profile={profile} onSave={next => persistBatch({profile: next}, 'preferences.update')} />}
          {tab === 'importar' && <ImportPanel products={products} customers={customers} profile={profile} onImport={(kind, records) => persistBatch({[kind]: records}, 'data.import')} />}
          {tab === 'planes' && <BillingPanel />}

          {tab === "venta" && <VentaTab products={products} customers={customers} insumos={insumos} onSaveSale={createSale} uiSettings={settings} />}
          {tab === "cotizaciones" && <CotizacionesTab quotes={quotes} products={products} customers={customers} onSave={saveQuote} onConvert={convertQuoteToSale} onUpdate={persistQuotes} />}
          {tab === "pedidos" && <PedidosTab sales={sales} onUpdate={updateSale} />}
          {tab === "webpedidos" && <WebOrdersTab orders={webOrders} customers={customers} loading={webOrdersLoading} adminSecret={webAdminSecret} onRefresh={refreshWebOrders} onImport={handleImportWebOrder} onReject={handleRejectWebOrder} onDelete={handleDeleteWebOrder} focusOrderId={focusedWebOrderId} onFocusHandled={() => setFocusedWebOrderId(null)} />}
          {tab === "costos" && <ProductosCostosTab products={products} insumos={insumos} onSaveProducts={persistProducts} onManageProducts={() => setTab("catalogo")} />}
          {tab === "catalogo" && <CatalogoProductos products={products} onSave={persistProducts} onBack={() => setTab("costos")} />}
          {tab === "inventario" && <InventarioTab products={products} insumos={insumos} productions={productions} movements={movements} onSaveProducts={persistProducts} onSaveInsumos={persistInsumos} onProduce={handleProduce} onAdjust={handleInventoryAdjustment} />}
          {tab === "finanzas" && <FinanzasTab sales={sales} expenses={expenses} suppliers={suppliers} insumos={insumos} budgets={budgets} onAddExpense={addExpense} onDeleteExpense={deleteExpense} onPayExpense={markExpensePaid} onSaveSuppliers={persistSuppliers} onSaveBudgets={persistBudgets} />}
          {tab === "graficos" && <GraficosTab sales={sales} expenses={expenses} products={products} insumos={insumos} />}
          {tab === "clientes" && <ClientesTab customers={customers} sales={sales} quotes={quotes} onSave={persistCustomers} />}
          {tab === "historial" && <HistorialTab sales={sales} expenses={expenses} productions={productions} movements={movements} onDeleteSale={handleDeleteSale} onUpdateSale={updateSale} />}
          {tab === "configuracion" && <ConfiguracionTab settings={settings} onChange={updateSettings} onReset={resetSettings} onPersonalize={()=>setStudioOpen(true)} exportBackup={exportBackup} importBackup={importBackup} setTab={setTab} products={products} webAdminSecret={webAdminSecret} onWebSecretChange={setWebAdminSecret} onRefreshWebOrders={refreshWebOrders} onPublishCatalog={handlePublishPublicCatalog} notificationPermission={notificationPermission} pushStatus={pushStatus} pushBusy={pushBusy} pushError={pushError} onEnableOrderNotifications={requestOrderNotifications} onDisableOrderNotifications={disableOrderNotifications} />}
          </>}
        </div></main>
      </div>

      {studioOpen&&<PersonalizeStudio settings={settings} profile={profile} systemDark={systemDark} onApply={updateSettings} onClose={()=>setStudioOpen(false)}/>}
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} products={products} sales={sales} customers={customers} goTo={setTab} money={CLP} />
      <MobileNav tab={tab} setTab={setTab} alerts={alerts} onMore={() => setMobileMoreOpen(true)} />
      <MobileMoreSheet open={mobileMoreOpen} onClose={() => setMobileMoreOpen(false)} tab={tab} setTab={setTab} alerts={alerts} />
    </div>
  );
}


// ============================================================
// Pedidos web
// ============================================================
function WebOrdersTab({ orders, customers, loading, adminSecret, onRefresh, onImport, onReject, onDelete, focusOrderId, onFocusHandled }) {
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const pending = (orders || []).filter((order) => !order.local_sale_id && !["Importado", "Cancelado"].includes(order.status));
  const imported = (orders || []).filter((order) => order.local_sale_id || order.status === "Importado");

  useEffect(() => {
    if (!focusOrderId) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector(`[data-web-order-id="${focusOrderId}"]`);
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      window.setTimeout(() => onFocusHandled?.(), 1800);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusOrderId, onFocusHandled, pending.length]);

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <KPI label="Nuevos pedidos web" value={String(pending.length)} icon={ShoppingCart} helper="Pendientes de confirmar" />
      <KPI label="Confirmados" value={String(imported.length)} icon={Check} helper="Ya están en Pedidos" />
    </div>

    <div className="flex items-center justify-between gap-3">
      <div><p className="font-brand text-xl font-semibold text-choco">Pedidos recibidos</p><p className="text-xs text-choco/45">Confirma, rechaza o elimina pruebas sin salir de esta pantalla.</p></div>
      <button onClick={() => onRefresh()} className="w-10 h-10 rounded-xl border border-oro/20 bg-white flex items-center justify-center text-choco/60" aria-label="Actualizar">{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}</button>
    </div>

    {PUBLIC_ORDERS_CLOUD_READY && !adminSecret ? <EmptyState>Configura la clave de Pedidos web en Ajustes → Pedidos web.</EmptyState> : pending.length === 0 ? <EmptyState>No hay pedidos web nuevos.</EmptyState> : <div className="space-y-3">{pending.map((order) => {
      const code = order.public_code || String(order.id || "").slice(-6).toUpperCase();
      const time = order.delivery_time ? String(order.delivery_time).slice(0,5) : "Sin hora";
      const orderItems = Array.isArray(order.items) ? order.items : [];
      const customerMatch = findExistingCustomerMatch(customers, { name: order.customer_name, phone: order.customer_phone });
      const focused = focusOrderId === order.id;
      return <Card key={order.id} data-web-order-id={order.id} className={"p-4 sm:p-5 transition-all " + (focused ? "ring-4 ring-oro/25 border-caramelo/40" : "")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="font-semibold text-choco truncate">{order.customer_name || "Cliente"}</p><Badge color="amber">Nuevo · #{code}</Badge></div><p className="text-xs text-choco/45 mt-1">{order.customer_phone || "Sin teléfono"} · {order.delivery_method || "Retiro"}</p></div>
          <p className="font-bold text-choco shrink-0">{CLP(order.total)}</p>
        </div>
        <div className="mt-3 rounded-2xl bg-crema/55 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-choco/65"><CalendarDays size={14} /> {order.delivery_date ? fmtDeliveryDate(order.delivery_date) : "Sin fecha"} · {time}</div>
          <div className="mt-2 space-y-1.5">{orderItems.map((item, index) => <div key={index} className="text-xs flex justify-between gap-3"><span className="text-choco/70"><strong>{item.qty}x</strong> {item.name}{cleanPrepNote(item.prepNote || item.prep_note) ? <span className="block text-[10px] text-caramelo ml-4">↳ {cleanPrepNote(item.prepNote || item.prep_note)}</span> : null}</span><span className="font-semibold shrink-0">{CLP(asNumber(item.price) * asNumber(item.qty))}</span></div>)}</div>
        </div>
        {order.notes && <p className="text-xs text-choco/50 mt-3">“{order.notes}”</p>}
        <div className={"mt-3 rounded-xl px-3 py-2 text-xs " + (customerMatch ? "bg-emerald-50 text-emerald-800" : "bg-white border border-oro/15 text-choco/50")}>
          {customerMatch ? <>Cliente reconocido: <strong>{customerMatch.customer.name}</strong>. Al confirmar, esta compra se sumará a su historial existente.</> : <>No encontré una coincidencia segura. Al confirmar se creará un cliente nuevo.</>}
        </div>
        <p className="text-[11px] text-choco/40 mt-3">Recibido {fmtDate(order.created_at || order.dateISO || todayISO())}</p>
        <div className="grid grid-cols-2 sm:flex gap-2 mt-4 pt-3 border-t border-oro/10">
          <button disabled={busyId === order.id} onClick={async () => { setBusyId(order.id); await onImport(order); setBusyId(null); }} className="min-h-11 px-3.5 rounded-xl bg-choco text-crema text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{busyId === order.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar pedido</button>
          <button disabled={busyId === order.id} onClick={async () => { setBusyId(order.id); await onReject(order); setBusyId(null); }} className="min-h-11 px-3.5 rounded-xl border border-oro/25 bg-white text-choco text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><XCircle size={14} /> Rechazar</button>
          {confirmDeleteId === order.id ? <>
            <button disabled={busyId === order.id} onClick={async () => { setBusyId(order.id); { if (await onDelete(order) === false) return false; } setBusyId(null); setConfirmDeleteId(null); }} className="min-h-11 px-3.5 rounded-xl bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 size={14} /> Eliminar definitivamente</button>
            <button onClick={() => setConfirmDeleteId(null)} className="min-h-11 px-3.5 rounded-xl border border-oro/20 bg-white text-choco/60 text-xs font-semibold">Cancelar</button>
          </> : <button onClick={() => setConfirmDeleteId(order.id)} className="min-h-11 px-3.5 rounded-xl text-red-600 text-xs font-semibold flex items-center justify-center gap-2 sm:ml-auto"><Trash2 size={14} /> Eliminar prueba</button>}
        </div>
      </Card>;
    })}</div>}
  </div>;
}

// ============================================================
// Resumen
// ============================================================
function ProgressMetric({ label, actual, target, reverse }) {
  const pct = target > 0 ? Math.min(150, Math.round((actual / target) * 100)) : 0;
  const bad = reverse ? actual > target : actual < target;
  return <div><div className="flex items-center justify-between text-sm mb-1"><span className="text-choco/70">{label}</span><span className={bad ? "font-semibold text-caramelo" : "font-semibold text-caramelo"}>{CLP(actual)} / {CLP(target)}</span></div><div className="h-2 bg-crema rounded-full overflow-hidden"><div className={bad ? "h-full bg-caramelo" : "h-full bg-caramelo"} style={{ width: `${Math.min(100, pct)}%` }} /></div><p className="text-[11px] text-choco/45 mt-1">{pct}%</p></div>;
}

function AlertCard({ title, icon: Icon, items, empty, onClick }) {
  return <Card className="p-4"><div className="flex items-center justify-between mb-3"><p className="text-sm font-semibold text-choco/80 flex items-center gap-1.5"><Icon size={15} /> {title}</p><button onClick={onClick} className="text-xs font-medium text-caramelo underline">Ver</button></div>{items.length === 0 ? <p className="text-sm text-choco/45">{empty}</p> : <div className="space-y-2">{items.map((item, idx) => <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-2 text-sm"><span className="text-choco/80 truncate">{item.name}</span><Badge color={item.danger ? "red" : "amber"}>{item.value}</Badge></div>)}</div>}</Card>;
}

function OrdersAlertCard({ sales, goTo }) {
  const [mode, setMode] = useState("entregar");
  const pendingOrders = sales.filter((s) => s.orderStatus !== "Entregado");
  const receivables = sales.filter((s) => s.balance > 0).sort((a, b) => b.balance - a.balance);
  const items = mode === "entregar"
    ? pendingOrders.slice(0, 6).map((s) => ({ name: s.customerName, value: s.orderStatus }))
    : receivables.slice(0, 6).map((s) => ({ name: s.customerName, value: CLP(s.balance), danger: true }));
  return <Card className="p-4">
    <div className="flex items-center justify-between mb-3 gap-2">
      <div className="flex rounded-lg bg-crema p-0.5 text-xs"><button onClick={() => setMode("entregar")} className={"px-2.5 py-1 rounded-md font-medium transition-colors " + (mode === "entregar" ? "bg-white text-choco shadow-sm" : "text-choco/50")}>Por entregar</button><button onClick={() => setMode("cobrar")} className={"px-2.5 py-1 rounded-md font-medium transition-colors " + (mode === "cobrar" ? "bg-white text-choco shadow-sm" : "text-choco/50")}>Por cobrar</button></div>
      <button onClick={() => goTo(mode === "entregar" ? "pedidos" : "historial")} className="text-xs font-medium text-caramelo underline shrink-0">Ver</button>
    </div>
    {items.length === 0 ? <p className="text-sm text-choco/45">{mode === "entregar" ? "No hay pedidos pendientes." : "No hay saldos por cobrar."}</p> : <div className="space-y-2">{items.map((item, idx) => <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-2 text-sm"><span className="text-choco/80 truncate">{item.name}</span><Badge color={item.danger ? "amber" : "amber"}>{item.value}</Badge></div>)}</div>}
  </Card>;
}

// ============================================================
// Venta
// ============================================================
function VentaTab({ products, customers, insumos, onSaveSale, uiSettings = DEFAULT_DEVICE_SETTINGS }) {
  const saleOperation = useRef(crypto.randomUUID());
  const [cart, setCart] = useState([]);
  useDraftGuard(cart.length > 0);
  const [customerMode, setCustomerMode] = useState("ocasional");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [payment, setPayment] = useState(uiSettings.defaultPaymentMethod || "Transferencia");
  const [paidAmount, setPaidAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [delivery, setDelivery] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [orderStatus, setOrderStatus] = useState(uiSettings.defaultOrderStatus || "Pendiente");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [prepOpenLineId, setPrepOpenLineId] = useState(null);
  const cartAnchorRef = useRef(null);

  const activeProducts = products.filter((p) => p.active !== false);
  const categories = ["Todos", ...Array.from(new Set(activeProducts.map((p) => p.category).filter(Boolean)))];
  const visibleProducts = activeProducts.filter((p) =>
    (category === "Todos" || p.category === category) &&
    `${p.name} ${p.category || ""}`.toLowerCase().includes(productSearch.toLowerCase())
  );
  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
  const { subtotal, total } = totalsFromItems(cart, discount, delivery);
  const cartItemsCount = cart.reduce((sum, item) => sum + asNumber(item.qty), 0);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  function addToCart(product) {
    setCart((previous) => {
      const existing = previous.find((item) => item.productId === product.id && !cleanPrepNote(item.prepNote));
      if (existing) return previous.map((item) => item.lineId === existing.lineId ? { ...item, qty: item.qty + 1 } : item);
      return [...previous, { lineId: uid("line"), productId: product.id, name: product.name, category: product.category || "", price: product.price, qty: 1, prepNote: "" }];
    });
  }

  function changeQty(lineId, delta) {
    setCart((previous) => previous
      .map((item) => item.lineId === lineId ? { ...item, qty: item.qty + delta } : item)
      .filter((item) => item.qty > 0));
  }

  function updatePrep(lineId, value) {
    setCart((previous) => previous.map((item) => {
      if (item.lineId !== lineId) return item;
      return isCuchufliLine(item) ? { ...item, prepNote: cleanPrepNote(value) } : { ...item, prepNote: "" };
    }));
  }

  function addVariant(item) {
    if (!isCuchufliLine(item)) return;
    const variant = { ...item, lineId: uid("line"), qty: 1, prepNote: "" };
    setCart((previous) => [...previous, variant]);
    setPrepOpenLineId(variant.lineId);
  }

  async function handleSave() {
    if (!cart.length) return;
    setSaving(true);
    const phone = customerMode === "nuevo"
      ? newCustPhone.trim()
      : customerMode === "existente"
        ? (selectedCustomer?.phone || "")
        : "";
    const result = await onSaveSale({ operationId: saleOperation.current,
      cart, customerMode, selectedCustomerId, newCustName, newCustPhone,
      payment, paidAmount, discount, delivery, deliveryDate, deliveryTime, paymentDueDate,
      orderStatus, notes,
    });
    if (result) {
      saleOperation.current = crypto.randomUUID();
      setLastReceipt({ sale: result, phone });
      setCart([]);
      setSelectedCustomerId(""); setCustomerSearch(""); setNewCustName(""); setNewCustPhone("");
      setCustomerMode("ocasional"); setPaymentDueDate(""); setPaidAmount(""); setDiscount(""); setDelivery("");
      setDeliveryDate(""); setDeliveryTime(""); setPayment(uiSettings.defaultPaymentMethod || "Transferencia");
      setOrderStatus(uiSettings.defaultOrderStatus || "Pendiente"); setNotes("");
      setAdjustmentsOpen(false); setPaymentOpen(false); setPrepOpenLineId(null);
    }
    setSaving(false);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] gap-4 lg:gap-5">
      {cart.length > 0 && <button
        onClick={() => cartAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        aria-label={`Ver venta: ${cartItemsCount} producto${cartItemsCount === 1 ? "" : "s"}, total ${CLP(total)}`}
        className="lg:hidden fixed left-4 right-4 z-[45] h-[56px] rounded-[18px] bg-choco text-crema shadow-[0_12px_32px_rgba(90,52,32,.22)] px-4 flex items-center justify-between gap-3 active:scale-[0.99]"
        style={{ bottom: "calc(66px + env(safe-area-inset-bottom) + 12px)" }}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><ShoppingCart size={17} /></span>
          <span className="min-w-0 text-left"><span className="block text-sm font-semibold leading-tight">{cartItemsCount} producto{cartItemsCount === 1 ? "" : "s"}</span><span className="block text-[10px] text-crema/65 leading-tight mt-0.5">Toca para revisar</span></span>
        </span>
        <span className="flex items-center gap-2 shrink-0"><strong className="text-base">{CLP(total)}</strong><ArrowRight size={16} /></span>
      </button>}

      {lastReceipt && <div className="lg:col-span-2">
        <Card className="p-4 bg-oro/10 border-oro/25 shadow-none">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-choco shrink-0"><Check size={18} /></span>
              <div><p className="font-semibold text-choco">Venta lista · {CLP(lastReceipt.sale.total)}</p><p className="text-xs text-choco/50 mt-0.5">Quedó registrada. Puedes seguir vendiendo sin hacer nada más.</p></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => shareReceiptImage(lastReceipt.sale)} className="px-3 py-2 rounded-xl bg-white border border-oro/20 text-sm font-semibold"><Receipt size={15} className="inline mr-1.5" /> Comprobante</button>
              {lastReceipt.phone && <a href={whatsappUrl(lastReceipt.phone, buildReceiptText(lastReceipt.sale))} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl bg-white border border-oro/20 text-sm font-semibold"><MessageCircle size={15} className="inline mr-1.5" /> WhatsApp</a>}
              <button onClick={() => setLastReceipt(null)} className="w-10 h-10 rounded-xl bg-white border border-oro/20"><X size={15} className="mx-auto" /></button>
            </div>
          </div>
        </Card>
      </div>}

      <section className={"min-w-0 " + (cart.length > 0 ? "pb-20 lg:pb-0" : "")}>
        <div className="mb-4">
          <p className="font-brand text-2xl font-semibold text-choco">¿Qué vendiste?</p>
          <p className="text-xs text-choco/45 mt-1">Toca los productos. El resto puede completarse después.</p>
        </div>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-3.5 text-choco/35" />
          <TextInput value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto" className="w-full pl-10 bg-white" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
          {categories.map((value) => <button key={value} onClick={() => setCategory(value)} className={"whitespace-nowrap min-h-9 px-4 rounded-full text-xs font-semibold border transition-colors " + (category === value ? "bg-choco text-crema border-choco" : "bg-white border-oro/15 text-choco/55")}>{value}</button>)}
        </div>

        {visibleProducts.length === 0 ? <EmptyState>No hay productos con ese filtro.</EmptyState> : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
            {visibleProducts.map((product) => <button key={product.id} onClick={() => addToCart(product)} className="group text-left bg-white rounded-[20px] border border-oro/15 overflow-hidden active:scale-[0.985] transition-all hover:border-oro/35 hover:shadow-sm">
              <div className="h-[96px] sm:h-[116px] bg-crema/70 flex items-center justify-center relative overflow-hidden">
                {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <Package size={30} strokeWidth={1.35} className="text-choco/28" />}
                {product.category && <span className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[9px] text-choco/55 font-bold">{product.category}</span>}
              </div>
              <div className="p-3 relative">
                <p className="font-semibold text-sm text-choco leading-tight pr-8 min-h-[34px]">{product.name}</p>
                <p className="text-caramelo font-bold mt-1">{CLP(product.price)}</p>
                <span className="absolute right-3 bottom-3 w-8 h-8 rounded-full bg-oro/18 text-choco flex items-center justify-center group-active:bg-choco group-active:text-crema"><Plus size={17} /></span>
              </div>
            </button>)}
          </div>
        )}
      </section>

      <aside ref={cartAnchorRef} className="space-y-3 lg:sticky lg:top-[90px] lg:self-start">
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-oro/10 flex items-center justify-between">
            <div><p className="font-brand text-xl font-semibold text-choco">Tu venta</p><p className="text-xs text-choco/40">{cartItemsCount ? `${cartItemsCount} unidad${cartItemsCount === 1 ? "" : "es"}` : "Todavía vacía"}</p></div>
            {cart.length > 0 && <span className="text-xl font-bold text-choco">{CLP(total)}</span>}
          </div>

          {cart.length === 0 ? <div className="px-4 py-9 text-center"><ShoppingCart size={27} className="mx-auto text-choco/20" /><p className="text-sm text-choco/40 mt-2">Agrega un producto para empezar.</p></div> : <div className="px-4 py-2">
            {cart.map((item) => {
              const prepOpen = prepOpenLineId === item.lineId;
              const special = isCuchufliLine(item) ? cleanPrepNote(item.prepNote) : "";
              return <div key={item.lineId} className="py-3 border-b border-oro/10 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0"><p className="truncate font-semibold text-sm text-choco/80">{item.name}</p><div className="flex items-center gap-1.5 mt-0.5"><p className="text-xs text-choco/40">{CLP(item.price * item.qty)}</p>{special && <span className="max-w-[150px] truncate px-2 py-0.5 rounded-full bg-rosa/15 text-[9px] font-bold text-choco/65">{special}</span>}</div></div>
                  <div className="flex items-center gap-1.5 bg-crema rounded-full p-1">
                    <button onClick={() => changeQty(item.lineId, -1)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center"><Minus size={13} /></button>
                    <span className="w-5 text-center text-sm font-semibold">{item.qty}</span>
                    <button onClick={() => changeQty(item.lineId, 1)} className="w-7 h-7 rounded-full bg-white flex items-center justify-center"><Plus size={13} /></button>
                  </div>
                </div>
                {isCuchufliLine(item) && <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => setPrepOpenLineId(prepOpen ? null : item.lineId)} className="text-[10px] font-semibold text-caramelo">{special ? "Editar cobertura" : "+ Elegir cobertura"}</button>
                  <button type="button" onClick={() => addVariant(item)} className="text-[10px] font-semibold text-choco/35">+ Otra variante</button>
                </div>}
                {isCuchufliLine(item) && prepOpen && <div className="mt-2.5 rounded-xl bg-crema/45 border border-oro/10 p-2.5">
                  <div className="flex gap-1.5 overflow-x-auto pb-2">{CUCHUFLI_PREP_OPTIONS.map((option) => <button key={option} type="button" onClick={() => updatePrep(item.lineId, option)} className={"shrink-0 px-2.5 min-h-8 rounded-full text-[10px] font-semibold border " + (prepLabel(item) === option ? "bg-choco text-crema border-choco" : "bg-white text-choco/55 border-oro/15")}>{option}</button>)}</div>
                  <TextInput value={item.prepNote || ""} onChange={(e) => updatePrep(item.lineId, e.target.value)} placeholder="Ej. mitad coco, mitad chocolate" className="w-full text-xs" />
                </div>}
              </div>;
            })}
          </div>}

          {cart.length > 0 && <div className="p-4 bg-crema/30 border-t border-oro/10">
            <button onClick={() => setAdjustmentsOpen(!adjustmentsOpen)} className="w-full flex items-center justify-between text-xs font-semibold text-choco/55">
              <span>{asNumber(discount) || asNumber(delivery) ? "Descuento y despacho aplicados" : "Agregar descuento o despacho"}</span>
              <span className="text-caramelo">{adjustmentsOpen ? "Ocultar" : "Opcional"}</span>
            </button>
            {adjustmentsOpen && <div className="grid grid-cols-2 gap-2 mt-3"><Field label="Descuento"><TextInput value={discount} onChange={(e) => setDiscount(e.target.value)} type="number" min="0" className="w-full" /></Field><Field label="Despacho"><TextInput value={delivery} onChange={(e) => setDelivery(e.target.value)} type="number" min="0" className="w-full" /></Field></div>}
            <div className="flex justify-between items-end mt-3 pt-3 border-t border-oro/10"><span className="text-sm text-choco/55">Total</span><span className="font-brand text-3xl font-semibold text-choco">{CLP(total)}</span></div>
          </div>}
        </Card>

        <Card className="p-4"><Field label="Vencimiento del pago (opcional)"><TextInput type="date" value={paymentDueDate} onChange={e=>setPaymentDueDate(e.target.value)} className="w-full"/></Field><p className="text-xs text-choco/50 mt-2">Se usa para alertas de cobros vencidos.</p></Card>
        <CustomerSelector customers={customers} customerMode={customerMode} setCustomerMode={setCustomerMode} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} newCustName={newCustName} setNewCustName={setNewCustName} newCustPhone={newCustPhone} setNewCustPhone={setNewCustPhone} filteredCustomers={filteredCustomers} />

        <Card className="overflow-hidden">
          <button onClick={() => setPaymentOpen(!paymentOpen)} className="w-full p-4 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0"><span className="w-10 h-10 rounded-xl bg-crema flex items-center justify-center text-choco shrink-0"><CreditCard size={17} /></span><div className="min-w-0"><p className="text-sm font-semibold text-choco">Pago y entrega</p><p className="text-xs text-choco/42 truncate">{payment} · {asNumber(paidAmount) > 0 ? `${CLP(paidAmount)} pagado` : "sin abono"}{deliveryDate ? ` · ${fmtDeliveryDate(deliveryDate)}` : ""}</p></div></div>
            <span className="text-xs font-semibold text-caramelo">{paymentOpen ? "Listo" : "Editar"}</span>
          </button>
          {paymentOpen && <div className="p-4 pt-0 space-y-3 border-t border-oro/10">
            <div className="pt-3 grid grid-cols-2 gap-2"><Field label="Método"><SelectInput value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full">{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</SelectInput></Field><Field label="Monto pagado"><TextInput value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} type="number" min="0" max={total} placeholder="0" className="w-full" /></Field></div>
            <div className="flex gap-2"><button type="button" onClick={() => setPaidAmount("")} className="flex-1 min-h-9 rounded-xl bg-crema text-xs font-semibold text-choco/60">Sin abono</button><button type="button" onClick={() => setPaidAmount(String(total))} className="flex-1 min-h-9 rounded-xl bg-oro/18 text-xs font-semibold text-choco">Pagado completo</button></div>
            <div className="flex gap-2"><button type="button" onClick={() => { setDeliveryDate(todayDate()); setOrderStatus("Pendiente"); }} className={"flex-1 min-h-9 rounded-xl text-xs font-semibold " + (deliveryDate === todayDate() ? "bg-choco text-crema" : "bg-crema text-choco/60")}>Hoy</button><button type="button" onClick={() => { setDeliveryDate(tomorrowDate()); setOrderStatus("Pendiente"); }} className={"flex-1 min-h-9 rounded-xl text-xs font-semibold " + (deliveryDate === tomorrowDate() ? "bg-choco text-crema" : "bg-oro/18 text-choco")}>Mañana</button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Field label="Fecha entrega"><TextInput type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full min-w-0" /></Field><Field label="Hora"><TextInput type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full min-w-0" /></Field></div>
            <Field label="Estado"><SelectInput value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="w-full">{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</SelectInput></Field>
            <Field label="Nota opcional"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Dirección o indicación especial" className="w-full" /></Field>
          </div>}
        </Card>

        <button onClick={handleSave} disabled={!cart.length || saving} className="w-full min-h-14 py-3.5 rounded-2xl bg-choco text-crema font-bold disabled:opacity-35 flex items-center justify-center gap-2 shadow-[0_12px_28px_rgba(90,52,32,.16)] active:scale-[0.99]">
          {saving && <Loader2 size={16} className="animate-spin" />} Registrar venta
        </button>
        {cart.length > 0 && <p className="text-[11px] text-center text-choco/35">Solo necesitas productos. Cliente, pago y entrega son opcionales.</p>}
      </aside>
    </div>
  );
}

function CustomerSelector(props) {
  const [open, setOpen] = useState(false);
  const selected = props.customers.find((c) => c.id === props.selectedCustomerId);
  const customerLabel = props.customerMode === "existente" && selected
    ? selected.name
    : props.customerMode === "nuevo" && props.newCustName.trim()
      ? props.newCustName.trim()
      : "Cliente ocasional";
  const customerHelper = props.customerMode === "existente" && selected?.phone
    ? selected.phone
    : props.customerMode === "nuevo" && props.newCustPhone.trim()
      ? props.newCustPhone.trim()
      : "No es obligatorio identificar al comprador";

  return <Card className="overflow-hidden">
    <button type="button" onClick={() => setOpen(!open)} className="w-full p-4 flex items-center justify-between gap-3 text-left">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-full bg-rosa/15 text-choco flex items-center justify-center shrink-0"><Users size={17} /></span>
        <div className="min-w-0"><p className="text-sm font-semibold text-choco truncate">{customerLabel}</p><p className="text-xs text-choco/40 truncate">{customerHelper}</p></div>
      </div>
      <span className="text-xs font-semibold text-caramelo">{open ? "Listo" : "Cambiar"}</span>
    </button>

    {open && <div className="p-4 pt-0 border-t border-oro/10">
      <p className="text-[11px] text-choco/40 pt-3 mb-2">¿Quieres asociar esta venta a alguien?</p>
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        {[["ocasional", "Ocasional"], ["existente", "Buscar"], ["nuevo", "Nuevo"]].map(([value, label]) => <button key={value} type="button" onClick={() => props.setCustomerMode(value)} className={"min-h-10 rounded-xl border font-semibold transition-colors " + (props.customerMode === value ? "bg-choco text-crema border-choco" : "bg-white text-choco/60 border-oro/20")}>{label}</button>)}
      </div>

      {props.customerMode === "existente" && <div>
        <div className="relative mb-2"><Search size={14} className="absolute left-3 top-3.5 text-choco/35" /><TextInput value={props.customerSearch} onChange={(e) => props.setCustomerSearch(e.target.value)} placeholder="Nombre del cliente" className="w-full pl-9" /></div>
        <div className="max-h-44 overflow-y-auto space-y-1">
          {props.filteredCustomers.length === 0 ? <p className="text-xs text-choco/40 py-3 text-center">No encontré clientes.</p> : props.filteredCustomers.slice(0, 12).map((customer) => <button key={customer.id} type="button" onClick={() => { props.setSelectedCustomerId(customer.id); setOpen(false); }} className={"w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center justify-between gap-2 " + (props.selectedCustomerId === customer.id ? "bg-oro/15 text-choco" : "hover:bg-crema") }><span className="truncate font-medium">{customer.name}</span>{customer.phone && <span className="text-[11px] text-choco/35 shrink-0">{customer.phone}</span>}</button>)}
        </div>
      </div>}

      {props.customerMode === "nuevo" && <div className="space-y-2">
        <TextInput value={props.newCustName} onChange={(e) => props.setNewCustName(e.target.value)} placeholder="Nombre" className="w-full" />
        <TextInput value={props.newCustPhone} onChange={(e) => props.setNewCustPhone(e.target.value)} placeholder="WhatsApp (opcional)" className="w-full" />
        <p className="text-[11px] text-choco/35">Se guardará automáticamente al registrar la venta.</p>
      </div>}

      {props.customerMode === "ocasional" && <p className="text-xs text-choco/42 rounded-xl bg-crema/60 px-3 py-2.5">Perfecto. Puedes registrar la venta sin pedir datos al cliente.</p>}
    </div>}
  </Card>;
}

// ============================================================
// Cotizaciones
// ============================================================
function CotizacionesTab({ quotes, products, customers, onSave, onConvert, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = quotes.filter((q) => `${q.customerName} ${q.status}`.toLowerCase().includes(search.toLowerCase()));

  async function changeStatus(id, status) {
    { if (await onUpdate(quotes.map((q) => q.id === id ? { ...q, status } : q)) === false) return false; }
  }

  return <div><div className="flex flex-col sm:flex-row gap-3 mb-4"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-choco/45" /><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cotización..." className="w-full pl-9" /></div><button onClick={() => { setEditing(null); setOpen(true); }} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] text-sm font-medium"><Plus size={16} /> Nueva cotización</button></div>
    {open && <QuoteModal quote={editing} products={products} customers={customers} onClose={() => setOpen(false)} onSave={async (data) => { { if (await onSave(data) === false) return false; } setOpen(false); }} />}
    {filtered.length === 0 ? <EmptyState>No hay cotizaciones registradas.</EmptyState> : <div className="space-y-2">{filtered.map((quote) => { const phone = customers.find((c) => c.id === quote.customerId)?.phone; return <Card key={quote.id} className="p-4"><div className="flex items-start justify-between gap-3 flex-wrap"><div><div className="flex gap-2 items-center flex-wrap"><p className="font-semibold text-choco">{quote.customerName}</p><Badge color={statusColor(quote.status)}>{quote.status}</Badge></div><p className="text-xs text-choco/45 mt-1">Creada {fmtDate(quote.dateISO, false)} · válida hasta {fmtDate(quote.validUntil, false)}</p><p className="text-xs text-choco/60 mt-2">{quote.items.map((i) => `${i.qty}x ${i.name}`).join(" · ")}</p>{quote.notes && <p className="text-xs italic text-choco/45 mt-1">{quote.notes}</p>}</div><div className="text-right"><p className="text-lg font-bold text-choco">{CLP(quote.total)}</p><div className="flex gap-1 mt-2 flex-wrap justify-end"><SelectInput value={quote.status} onChange={(e) => changeStatus(quote.id, e.target.value)} className="py-1 text-xs">{QUOTE_STATUSES.map((status) => <option key={status}>{status}</option>)}</SelectInput>{phone && <a href={whatsappUrl(phone, buildQuoteText(quote))} target="_blank" rel="noreferrer" className="p-1.5 border border-oro/25 rounded-lg text-choco/70 hover:bg-crema transition-colors" title="Enviar por WhatsApp"><MessageCircle size={14} /></a>}<button onClick={() => { setEditing(quote); setOpen(true); }} className="p-1.5 border border-oro/25 rounded-lg text-choco/70 hover:bg-crema transition-colors"><Pencil size={14} /></button>{!quote.convertedSaleId && <button onClick={() => onConvert(quote)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] text-xs"><ArrowRight size={13} /> Convertir en venta</button>}</div></div></div></Card>; })}</div>}
  </div>;
}

function QuoteModal({ quote, products, customers, onClose, onSave }) {
  const [items, setItems] = useState(quote?.items || []);
  const [customerMode, setCustomerMode] = useState(quote?.customerId ? "existente" : "ocasional");
  const [selectedCustomerId, setSelectedCustomerId] = useState(quote?.customerId || "");
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [discount, setDiscount] = useState(quote?.discount || "");
  const [delivery, setDelivery] = useState(quote?.delivery || "");
  const [validUntil, setValidUntil] = useState(quote?.validUntil?.slice(0, 10) || todayDate());
  const [status, setStatus] = useState(quote?.status || "Borrador");
  const [notes, setNotes] = useState(quote?.notes || "");
  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
  const totals = totalsFromItems(items, discount, delivery);

  function add(product) {
    setItems((previous) => {
      const existing = previous.find((i) => i.productId === product.id);
      if (existing) return previous.map((i) => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...previous, { productId: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  }

  return <Modal title={quote ? "Editar cotización" : "Nueva cotización"} onClose={onClose} wide><div className="grid md:grid-cols-2 gap-5"><div><p className="text-xs font-semibold text-choco/60 mb-2">Productos</p><div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">{products.filter((p) => p.active !== false).map((product) => <button key={product.id} onClick={() => add(product)} className="text-left border border-oro/25 rounded-lg p-2 hover:border-caramelo"><p className="text-sm font-medium">{product.name}</p><p className="text-xs text-caramelo">{CLP(product.price)}</p></button>)}</div><div className="mt-3 space-y-2">{items.map((item) => <div key={item.productId} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate">{item.name}</span><TextInput type="number" min="1" value={item.qty} onChange={(e) => setItems(items.map((i) => i.productId === item.productId ? { ...i, qty: Math.max(1, asNumber(e.target.value)) } : i))} className="w-16 py-1" /><TextInput type="number" min="0" value={item.price} onChange={(e) => setItems(items.map((i) => i.productId === item.productId ? { ...i, price: asNumber(e.target.value) } : i))} className="w-24 py-1" /><button onClick={() => setItems(items.filter((i) => i.productId !== item.productId))} className="text-red-400"><Trash2 size={14} /></button></div>)}</div></div><div className="space-y-3"><CustomerSelector customers={customers} customerMode={customerMode} setCustomerMode={setCustomerMode} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} newCustName={newCustName} setNewCustName={setNewCustName} newCustPhone={newCustPhone} setNewCustPhone={setNewCustPhone} filteredCustomers={filteredCustomers} /><div className="grid grid-cols-2 gap-2"><Field label="Válida hasta"><TextInput type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full" /></Field><Field label="Estado"><SelectInput value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">{QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}</SelectInput></Field><Field label="Descuento"><TextInput type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full" /></Field><Field label="Despacho"><TextInput type="number" value={delivery} onChange={(e) => setDelivery(e.target.value)} className="w-full" /></Field></div><Field label="Notas y condiciones"><TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" /></Field><div className="flex justify-between border-t pt-3"><span className="font-medium">Total cotizado</span><span className="text-xl font-bold text-choco">{CLP(totals.total)}</span></div><button disabled={!items.length || (customerMode === "nuevo" && !newCustName.trim())} onClick={() => onSave({ id: quote?.id, dateISO: quote?.dateISO, items, customerMode, selectedCustomerId, newCustName, newCustPhone, discount, delivery, validUntil, status, notes })} className="w-full py-2.5 rounded-lg bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] font-medium disabled:opacity-40"><Save size={15} className="inline mr-1" /> Guardar cotización</button></div></div></Modal>;
}

// ============================================================
// Pedidos y pagos
// ============================================================
function PedidosTab({ sales, onUpdate }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Activos");
  const [selectedId, setSelectedId] = useState(null);
  const todayKey = todayDate();
  const tomorrowKey = tomorrowDate();

  const filtered = sales.filter((sale) => {
    const matchesSearch = `${sale.customerName} ${sale.items.map((i) => `${i.name} ${i.prepNote || ""}`).join(" ")} ${sale.deliveryDate || ""} ${sale.deliveryTime || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "Todos"
      || (filter === "Activos" && sale.orderStatus !== "Entregado")
      || (filter === "Hoy" && sale.deliveryDate === todayKey && sale.orderStatus !== "Entregado")
      || (filter === "Mañana" && sale.deliveryDate === tomorrowKey && sale.orderStatus !== "Entregado")
      || (filter === "Atrasados" && sale.deliveryDate && sale.deliveryDate < todayKey && sale.orderStatus !== "Entregado")
      || (filter === "Por cobrar" && asNumber(sale.balance) > 0)
      || sale.orderStatus === filter;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    if (a.orderStatus === "Entregado" && b.orderStatus !== "Entregado") return 1;
    if (b.orderStatus === "Entregado" && a.orderStatus !== "Entregado") return -1;
    return deliverySortValue(a) - deliverySortValue(b) || new Date(b.dateISO) - new Date(a.dateISO);
  });

  const active = sales.filter((sale) => sale.orderStatus !== "Entregado").length;
  const dueToday = sales.filter((sale) => sale.deliveryDate === todayKey && sale.orderStatus !== "Entregado").length;
  const dueTomorrowSales = sales.filter((sale) => sale.deliveryDate === tomorrowKey && sale.orderStatus !== "Entregado");
  const dueTomorrow = dueTomorrowSales.length;
  const overdue = sales.filter((sale) => sale.deliveryDate && sale.deliveryDate < todayKey && sale.orderStatus !== "Entregado").length;
  const receivableCount = sales.filter((sale) => asNumber(sale.balance) > 0).length;
  const selectedSale = sales.find((sale) => sale.id === selectedId);
  const filterOptions = [
    ["Activos", active],
    ["Hoy", dueToday],
    ["Mañana", dueTomorrow],
    ...(overdue > 0 ? [["Atrasados", overdue]] : []),
    ["Por cobrar", receivableCount],
    ["Todos", sales.length],
  ];

  useEffect(() => { if (filter === "Atrasados" && overdue === 0) setFilter("Activos"); }, [filter, overdue]);

  return <div className="space-y-3.5">
    {dueTomorrow > 0 && <TomorrowPreparationCard sales={dueTomorrowSales} expanded={filter === "Mañana"} onOpen={() => setFilter("Mañana")} />}

    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {filterOptions.map(([value, count]) => <button key={value} onClick={() => setFilter(value)} className={"shrink-0 min-h-9 px-3.5 rounded-full border text-xs font-semibold transition-colors " + (filter === value ? "bg-choco text-crema border-choco" : "bg-white border-oro/15 text-choco/55")}>{value}<span className={"ml-1.5 " + (filter === value ? "text-crema/65" : "text-choco/30")}>{count}</span></button>)}
    </div>

    <div className="relative">
      <Search size={15} className="absolute left-3.5 top-3.5 text-choco/30" />
      <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente o producto" className="w-full pl-10 bg-white" />
    </div>

    {filtered.length === 0 ? <EmptyState>No hay pedidos con ese filtro.</EmptyState> : <div className="space-y-2.5">
      {filtered.map((sale) => <PedidoCompactCard key={sale.id} sale={sale} onOpen={() => setSelectedId(sale.id)} />)}
    </div>}

    {selectedSale && <PedidoDetailModal sale={selectedSale} onUpdate={onUpdate} onClose={() => setSelectedId(null)} />}
  </div>;
}

function TomorrowPreparationCard({ sales, expanded, onOpen }) {
  const totalUnits = sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + asNumber(item.qty), 0), 0);
  const grouped = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => sale.items.forEach((item) => {
      const key = item.productId || item.name;
      if (!map.has(key)) map.set(key, { name: item.name, total: 0, variants: {} });
      const row = map.get(key);
      row.total += asNumber(item.qty);
      const label = prepLabel(item);
      row.variants[label] = (row.variants[label] || 0) + asNumber(item.qty);
    }));
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [sales]);

  return <Card className="overflow-hidden border-oro/25 shadow-none">
    <button type="button" onClick={onOpen} className="w-full p-4 flex items-center justify-between gap-3 text-left bg-oro/[0.07]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 rounded-2xl bg-white border border-oro/15 flex items-center justify-center text-caramelo shrink-0"><CalendarDays size={18} /></span>
        <div className="min-w-0"><p className="font-brand text-lg font-semibold text-choco">Preparar para mañana</p><p className="text-xs text-choco/45 mt-0.5">{sales.length} pedido{sales.length === 1 ? "" : "s"} · {totalUnits} unidad{totalUnits === 1 ? "" : "es"}</p></div>
      </div>
      <span className="text-xs font-semibold text-caramelo shrink-0">{expanded ? "Viendo" : "Ver plan"}</span>
    </button>
    {expanded && <div className="px-4 pb-4 border-t border-oro/10 bg-white">
      <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-choco/35 pt-3 mb-2">Resumen de preparación</p>
      <div className="space-y-2">{grouped.map((row) => <div key={row.name} className="rounded-xl bg-crema/55 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-choco truncate">{row.name}</p><strong className="text-sm text-choco shrink-0">{NUM(row.total)} unid.</strong></div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">{Object.entries(row.variants).map(([label, qty]) => <span key={label} className={"px-2 py-1 rounded-full text-[9px] font-bold " + (label === "Estándar" ? "bg-white text-choco/45" : "bg-rosa/15 text-choco/70")}>{qty} {label.toLowerCase()}</span>)}</div>
      </div>)}</div>
    </div>}
  </Card>;
}

function PedidoCompactCard({ sale, onOpen }) {
  const todayKey = todayDate();
  const overdue = sale.deliveryDate && sale.deliveryDate < todayKey && sale.orderStatus !== "Entregado";
  const dueToday = sale.deliveryDate === todayKey && sale.orderStatus !== "Entregado";
  const itemCount = sale.items.reduce((sum, item) => sum + asNumber(item.qty), 0);
  const itemSummary = sale.items.slice(0, 2).map((item) => `${item.qty}x ${item.name}${cleanPrepNote(item.prepNote) ? ` · ${cleanPrepNote(item.prepNote)}` : ""}`).join(" · ");
  const extraItems = Math.max(0, sale.items.length - 2);
  const deliveryText = sale.deliveryDate
    ? `${sale.deliveryDate === todayKey ? "Hoy" : fmtDeliveryDate(sale.deliveryDate)}${sale.deliveryTime ? ` · ${sale.deliveryTime}` : ""}`
    : "Sin fecha";

  return <button onClick={onOpen} className={"w-full text-left bg-white rounded-[18px] border p-3.5 sm:p-4 transition-all active:scale-[0.99] " + (overdue ? "border-red-200" : dueToday ? "border-oro/35" : "border-oro/12")}>
    <div className="flex items-start gap-3">
      <div className={"w-11 h-11 rounded-2xl flex flex-col items-center justify-center shrink-0 " + (overdue ? "bg-red-50 text-red-700" : dueToday ? "bg-oro/15 text-choco" : "bg-crema text-choco/60")}>
        <CalendarDays size={15} />
        <span className="text-[9px] font-bold mt-0.5">{sale.deliveryTime || (sale.deliveryDate ? fmtDeliveryDate(sale.deliveryDate).split(" ")[0] : "—")}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-choco truncate">{sale.customerName}</p>
            <p className="text-[11px] text-choco/42 truncate mt-0.5">{itemSummary}{extraItems ? ` · +${extraItems} más` : ""}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-choco">{CLP(sale.total)}</p>
            <ArrowRight size={14} className="ml-auto mt-1 text-choco/25" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-oro/10">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge color={overdue ? "red" : statusColor(sale.orderStatus)}>{overdue ? "Atrasado" : sale.orderStatus}</Badge>
            {asNumber(sale.balance) > 0 ? <span className="text-[10px] text-caramelo font-semibold whitespace-nowrap">Saldo {CLP(sale.balance)}</span> : <span className="text-[10px] text-choco/35">Pagado</span>}
          </div>
          <span className="text-[10px] text-choco/35 shrink-0 max-w-[42%] truncate">{itemCount} unid. · {deliveryText}</span>
        </div>
      </div>
    </div>
  </button>;
}

function PedidoItemPreparationRow({ sale, item, index, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item.prepNote || "");

  useEffect(() => { setDraft(item.prepNote || ""); }, [item.prepNote]);

  async function save(value = draft) {
    const nextValue = isCuchufliLine(item) ? cleanPrepNote(value) : "";
    const nextItems = sale.items.map((row, rowIndex) => rowIndex === index ? { ...row, prepNote: nextValue } : row);
    { if (await onUpdate(sale.id, { items: nextItems }) === false) return false; }
    setDraft(nextValue);
    setOpen(false);
  }

  const special = isCuchufliLine(item) ? cleanPrepNote(item.prepNote) : "";
  return <div className="px-3.5 py-3 border-b border-oro/10 last:border-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-choco truncate">{item.name}</p><p className="text-[11px] text-choco/40">{item.qty} × {CLP(item.price)}</p>{special && <span className="inline-flex mt-1.5 px-2 py-1 rounded-full bg-rosa/15 text-[9px] font-bold text-choco/70">{special}</span>}</div>
      <div className="text-right shrink-0"><p className="text-sm font-bold text-choco">{CLP(asNumber(item.qty) * asNumber(item.price))}</p>{isCuchufliLine(item) && <button type="button" onClick={() => setOpen(!open)} className="text-[10px] font-semibold text-caramelo mt-1">{special ? "Editar cobertura" : "+ Cobertura"}</button>}</div>
    </div>
    {isCuchufliLine(item) && open && <div className="mt-2.5 rounded-xl bg-crema/45 p-2.5">
      <div className="flex gap-1.5 overflow-x-auto pb-2">{CUCHUFLI_PREP_OPTIONS.map((option) => <button key={option} type="button" onClick={() => { setDraft(cleanPrepNote(option)); save(option); }} className={"shrink-0 px-2.5 min-h-8 rounded-full text-[10px] font-semibold border " + (prepLabel({ prepNote: draft }) === option ? "bg-choco text-crema border-choco" : "bg-white text-choco/55 border-oro/15")}>{option}</button>)}</div>
      <div className="flex gap-2"><TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ej. mitad coco, mitad chocolate" className="flex-1 min-w-0 text-xs" /><button type="button" onClick={() => save()} className="px-3 rounded-xl bg-choco text-crema text-xs font-semibold">Guardar</button></div>
    </div>}
  </div>;
}

function PedidoDetailModal({ sale, onUpdate, onClose }) {
  const [payment, setPayment] = useState("");
  const [notes, setNotes] = useState(sale.notes || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNotes(sale.notes || ""); setPayment(""); }, [sale.id]);

  async function addPayment() {
    const amount = asNumber(payment);
    if (amount <= 0 || amount > asNumber(sale.balance)) return;
    setBusy(true);
    try {
      if (await onUpdate(sale.id, { paidAmount: asNumber(sale.paidAmount) + amount }) === false) return false;
      setPayment("");
    } finally { setBusy(false); }
  }

  async function saveNotes() {
    if (notes !== (sale.notes || "")) { if (await onUpdate(sale.id, { notes }) === false) return false; }
  }

  return <Modal title={sale.customerName} onClose={onClose} wide>
    <div className="space-y-4">
      <div className="rounded-2xl bg-crema/55 border border-oro/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap"><Badge color={statusColor(sale.orderStatus)}>{sale.orderStatus}</Badge><Badge color={statusColor(sale.paymentStatus)}>{sale.paymentStatus}</Badge></div>
            <p className="text-xs text-choco/42 mt-2">Registrado {fmtDate(sale.dateISO)} · {sale.paymentMethod}</p>
          </div>
          <div className="text-right"><p className="font-brand text-3xl font-semibold text-choco">{CLP(sale.total)}</p>{sale.balance > 0 && <p className="text-xs font-semibold text-caramelo mt-0.5">Saldo {CLP(sale.balance)}</p>}</div>
        </div>
      </div>

      <section>
        <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-choco/35 mb-2">Productos</p>
        <div className="rounded-2xl border border-oro/12 bg-white overflow-hidden">
          {sale.items.map((item, index) => <PedidoItemPreparationRow key={`${item.lineId || item.productId || item.name}_${index}`} sale={sale} item={item} index={index} onUpdate={onUpdate} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-oro/12 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2"><CalendarDays size={16} className="text-caramelo" /><p className="font-semibold text-sm text-choco">Entrega y estado</p></div>
        <Field label="Estado del pedido"><SelectInput value={sale.orderStatus} onChange={(e) => onUpdate(sale.id, { orderStatus: e.target.value })} className="w-full">{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</SelectInput></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Fecha"><TextInput type="date" value={sale.deliveryDate || ""} onChange={(e) => onUpdate(sale.id, { deliveryDate: e.target.value })} className="w-full min-w-0" /></Field><Field label="Hora"><TextInput type="time" value={sale.deliveryTime || ""} onChange={(e) => onUpdate(sale.id, { deliveryTime: e.target.value })} className="w-full min-w-0" /></Field></div>
      </section>

      <section className="rounded-2xl border border-oro/12 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3"><div className="flex items-center gap-2"><CreditCard size={16} className="text-caramelo" /><div><p className="font-semibold text-sm text-choco">Pago</p><p className="text-[11px] text-choco/40">Pagado {CLP(sale.paidAmount)} de {CLP(sale.total)}</p></div></div>{sale.balance <= 0 && <Badge color="emerald">Listo</Badge>}</div>
        {sale.balance > 0 ? <div className="space-y-2.5"><div className="flex gap-2"><TextInput value={payment} onChange={(e) => setPayment(e.target.value)} type="number" min="0" max={sale.balance} placeholder={`Abono hasta ${sale.balance}`} className="flex-1 min-w-0" /><button onClick={addPayment} disabled={busy || asNumber(payment) <= 0} className="min-w-12 rounded-xl bg-choco text-crema disabled:opacity-35 flex items-center justify-center">{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}</button></div><button onClick={() => onUpdate(sale.id, { paidAmount: sale.total })} className="w-full min-h-10 rounded-xl bg-oro/15 text-xs font-semibold text-choco">Marcar completamente pagado</button></div> : <p className="text-xs text-choco/42">Este pedido no tiene saldo pendiente.</p>}
      </section>

      <section className="rounded-2xl border border-oro/12 bg-white p-4">
        <Field label="Nota opcional"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} rows={3} placeholder="Dirección, referencia o indicación especial" className="w-full" /></Field>
      </section>

      <button onClick={async () => { await saveNotes(); onClose(); }} className="w-full min-h-12 rounded-2xl bg-choco text-crema font-semibold">Listo</button>
    </div>
  </Modal>;
}

// ============================================================
// Productos, costos y rentabilidad
// ============================================================
function ProductosCostosTab({ products, insumos, onSaveProducts, onManageProducts }) {
  const [sub, setSub] = usePersistentView("costosSub", "productos");
  const [editing, setEditing] = useState(null);
  const activeProducts = products.filter((p) => p.active !== false);
  const [simProductId, setSimProductId] = useState(activeProducts[0]?.id || "");
  const [simPrice, setSimPrice] = useState("");
  const [targetMargin, setTargetMargin] = useState("55");

  useEffect(() => {
    if (!activeProducts.some((p) => p.id === simProductId)) setSimProductId(activeProducts[0]?.id || "");
  }, [products, simProductId]);

  const simProduct = activeProducts.find((p) => p.id === simProductId) || activeProducts[0];
  useEffect(() => { if (simProduct) setSimPrice(String(simProduct.price || "")); }, [simProductId]);

  const tabs = [["productos", "Productos y margen"], ["simulador", "Simulador de precio"]];
  return <div>
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">{tabs.map(([value, label]) => <button key={value} onClick={() => setSub(value)} className={"px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap " + (sub === value ? "bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98]" : "bg-white border border-oro/25 text-choco/70")}>{label}</button>)}</div>

    {sub === "productos" && <div>
      <Card className="p-4 mb-4 bg-crema/40 shadow-none">
        <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl bg-white border border-oro/15 flex items-center justify-center text-caramelo shrink-0"><CircleDollarSign size={19} /></span><div><p className="font-semibold text-choco">Costeo conectado con tus insumos</p><p className="text-xs text-choco/50 mt-1">Cuando cambia el costo de un insumo, el costo actual y el margen del producto se recalculan. Las ventas ya registradas conservan el costo que tenían al momento de venderse.</p></div></div>
      </Card>
      <div className="flex justify-end mb-3">
        <button onClick={onManageProducts} className="min-h-11 px-4 rounded-xl border border-oro/25 bg-white text-sm font-semibold text-choco hover:bg-crema transition-colors"><PackagePlus size={15} className="inline mr-1.5" /> Editar catálogo</button>
      </div>
      <div className="grid xl:grid-cols-2 gap-3">
        {activeProducts.map((product) => {
          const b = productCostBreakdown(product, insumos);
          const profit = asNumber(product.price) - b.total;
          const margin = asNumber(product.price) > 0 ? profit / asNumber(product.price) * 100 : 0;
          return <Card key={product.id} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="font-semibold text-choco truncate">{product.name}</p><Badge color="stone">{product.category}</Badge>{product.costing?.enabled && <Badge color="emerald">Costeo por lote</Badge>}{b.missingCosts?.length > 0 && <Badge color="amber">Costo incompleto</Badge>}</div><p className="text-xs text-choco/45 mt-1">{b.source}{product.costing?.enabled ? ` · rendimiento ${NUM(b.yieldQty, 1)}` : ""}</p></div>
              <button onClick={() => setEditing(product.id)} className="w-9 h-9 rounded-xl border border-oro/20 bg-white flex items-center justify-center text-choco/65 hover:bg-crema"><Pencil size={15} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Venta</p><p className="font-bold text-choco mt-1">{CLP(product.price)}</p></div>
              <div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Costo</p><p className="font-bold text-choco mt-1">{b.missingCosts?.length ? "Incompleto" : CLP(b.total)}</p></div>
              <div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Ganancia</p><p className={"font-bold mt-1 " + (profit < 0 ? "text-red-600" : "text-caramelo")}>{b.missingCosts?.length ? "—" : CLP(profit)}</p></div>
              <div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Margen</p><p className={"font-bold mt-1 " + (margin < 35 ? "text-red-600" : "text-choco")}>{b.missingCosts?.length ? "—" : `${NUM(margin, 1)}%`}</p></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2 mt-4 pt-4 border-t border-oro/15 text-xs">
              <CostMini label="Ingredientes" value={b.ingredients} />
              <CostMini label="Envases" value={b.packaging} />
              <CostMini label="Merma" value={b.waste} />
              <CostMini label="Mano de obra" value={b.labor} />
              <CostMini label="Otros" value={b.other} />
            </div>
          </Card>;
        })}
      </div>
      {activeProducts.length === 0 && <EmptyState>No hay productos activos. Puedes crear o restaurar uno desde “Gestionar productos”.</EmptyState>}
    </div>}

    {sub === "simulador" && <PriceSimulator product={simProduct} products={activeProducts} insumos={insumos} productId={simProductId} setProductId={setSimProductId} price={simPrice} setPrice={setSimPrice} targetMargin={targetMargin} setTargetMargin={setTargetMargin} />}

    {editing && (() => { const product = products.find((p) => p.id === editing); return product ? <ProductCostModal product={product} products={products} insumos={insumos} onClose={() => setEditing(null)} onSave={async (nextProduct) => { { if (await onSaveProducts(products.map((p) => p.id === nextProduct.id ? nextProduct : p)) === false) return false; } setEditing(null); }} /> : null; })()}
  </div>;
}

function CostMini({ label, value }) {
  return <div><p className="text-choco/40">{label}</p><p className="font-semibold text-choco mt-0.5">{CLP(value)}</p></div>;
}

function PriceSimulator({ product, products, insumos, productId, setProductId, price, setPrice, targetMargin, setTargetMargin }) {
  if (!product) return <EmptyState>Crea un producto para utilizar el simulador.</EmptyState>;
  const b = productCostBreakdown(product, insumos);
  const simulated = Math.max(0, asNumber(price));
  const profit = simulated - b.total;
  const margin = simulated > 0 ? profit / simulated * 100 : 0;
  const target = Math.min(95, Math.max(0, asNumber(targetMargin)));
  const suggested = target < 100 ? b.total / Math.max(0.01, 1 - target / 100) : 0;
  const roundedSuggested = Math.ceil(suggested / 50) * 50;
  return <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
    <Card className="p-4 sm:p-5 space-y-4"><div><p className="font-brand text-xl font-semibold text-choco">Probar un precio</p><p className="text-xs text-choco/45 mt-1">No modifica el precio real hasta que lo cambies desde la ficha del producto.</p></div>{b.missingCosts?.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Completa primero el precio de compra de: <strong>{b.missingCosts.join(", ")}</strong>. El simulador no mostrará un margen confiable hasta entonces.</div>}<Field label="Producto"><SelectInput value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</SelectInput></Field><div className="grid grid-cols-2 gap-3"><Field label="Precio a simular"><TextInput type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full" /></Field><Field label="Margen objetivo %"><TextInput type="number" min="0" max="95" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} className="w-full" /></Field></div><div className="rounded-2xl bg-crema p-4"><div className="flex justify-between text-sm"><span className="text-choco/55">Costo unitario actual</span><strong>{CLP(b.total)}</strong></div><div className="flex justify-between text-sm mt-2"><span className="text-choco/55">Ganancia con {CLP(simulated)}</span><strong className={profit < 0 ? "text-red-600" : "text-caramelo"}>{b.missingCosts?.length ? "—" : CLP(profit)}</strong></div><div className="flex justify-between text-sm mt-2"><span className="text-choco/55">Margen resultante</span><strong>{b.missingCosts?.length ? "—" : `${NUM(margin, 1)}%`}</strong></div></div></Card>
    <Card className="p-4 sm:p-5 h-fit"><p className="text-xs uppercase tracking-wider text-choco/40 font-bold">Precio sugerido</p><p className="font-brand text-4xl font-semibold text-choco mt-2">{b.missingCosts?.length ? "—" : CLP(roundedSuggested)}</p><p className="text-sm text-choco/55 mt-2">Para aproximarte a un margen de <strong>{NUM(target, 1)}%</strong>, considerando el costo actual de {CLP(b.total)}.</p><div className="mt-5 pt-4 border-t border-oro/15"><p className="text-xs text-choco/45">Precio actual</p><p className="font-semibold mt-1">{CLP(product.price)} · margen {NUM(product.price > 0 ? (product.price - b.total) / product.price * 100 : 0, 1)}%</p></div></Card>
  </div>;
}

function ProductCostModal({ product, insumos, onClose, onSave }) {
  const initialCosting = product.costing || { enabled: false, yieldQty: 1, recipe: [] };
  const [form, setForm] = useState({
    price: String(product.price || 0), laborCost: String(product.laborCost || 0), otherCost: String(product.otherCost || 0),
    wastePercent: String(product.wastePercent || 0), costingEnabled: Boolean(initialCosting.enabled),
    yieldQty: String(initialCosting.yieldQty || 1), costRecipe: initialCosting.recipe?.length ? initialCosting.recipe.map((r) => ({ ...r })) : (product.recipe || []).map((r) => ({ ...r })),
  });
  const preview = { ...product, price: asNumber(form.price), laborCost: asNumber(form.laborCost), otherCost: asNumber(form.otherCost), wastePercent: asNumber(form.wastePercent), costing: { enabled: form.costingEnabled, yieldQty: Math.max(1, asNumber(form.yieldQty)), recipe: form.costRecipe } };
  const b = productCostBreakdown(preview, insumos);
  const profit = asNumber(form.price) - b.total;
  const margin = asNumber(form.price) > 0 ? profit / asNumber(form.price) * 100 : 0;
  function addCostLine() { const available = insumos.filter((i) => i.active !== false); if (available.length) setForm({ ...form, costRecipe: [...form.costRecipe, { insumoId: available[0].id, qty: 0 }] }); }
  function save() { onSave(preview); }
  return <Modal title={`Costos · ${product.name}`} onClose={onClose} wide><div className="space-y-5">
    <div className="grid sm:grid-cols-4 gap-3"><Field label="Precio de venta"><TextInput type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full" /></Field><Field label="Mano de obra / unidad"><TextInput type="number" value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} className="w-full" /></Field><Field label="Otros costos / unidad"><TextInput type="number" value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} className="w-full" /></Field><Field label="Merma % ingredientes"><TextInput type="number" min="0" value={form.wastePercent} onChange={(e) => setForm({ ...form, wastePercent: e.target.value })} className="w-full" /></Field></div>

    <Card className="p-4 bg-crema/40 shadow-none"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold text-choco">Costeo personalizado por lote</p><p className="text-xs text-choco/45 mt-1">Úsalo si una receta completa rinde varias unidades. Es independiente de la receta que descuenta inventario.</p></div><button type="button" role="switch" aria-checked={form.costingEnabled} onClick={() => setForm({ ...form, costingEnabled: !form.costingEnabled })} className={"relative w-12 h-7 rounded-full overflow-hidden shrink-0 transition-colors " + (form.costingEnabled ? "bg-choco" : "bg-choco/15")}><span className={"absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform " + (form.costingEnabled ? "translate-x-5" : "translate-x-0")} /></button></div></Card>

    {form.costingEnabled ? <div><div className="flex items-end justify-between gap-3 mb-3"><div className="max-w-[180px]"><Field label="Rendimiento del lote"><TextInput type="number" min="1" value={form.yieldQty} onChange={(e) => setForm({ ...form, yieldQty: e.target.value })} className="w-full" /></Field></div><button onClick={addCostLine} className="px-3 py-2 rounded-xl border border-oro/20 bg-white text-sm font-semibold text-caramelo"><Plus size={14} className="inline mr-1" /> Ingrediente</button></div><div className="space-y-2">{form.costRecipe.map((row, index) => { const insumo = insumos.find((i) => i.id === row.insumoId); return <div key={`${row.insumoId}_${index}`} className="grid grid-cols-[1fr_100px_90px_32px] gap-2 items-center"><SelectInput value={row.insumoId} onChange={(e) => setForm({ ...form, costRecipe: form.costRecipe.map((r, i) => i === index ? { ...r, insumoId: e.target.value } : r) })}>{insumos.filter((i) => i.active !== false || i.id === row.insumoId).map((i) => <option key={i.id} value={i.id}>{i.name}{i.active === false ? " (eliminado)" : ""}</option>)}</SelectInput><TextInput type="number" value={row.qty} onChange={(e) => setForm({ ...form, costRecipe: form.costRecipe.map((r, i) => i === index ? { ...r, qty: asNumber(e.target.value) } : r) })} /><span className="text-xs text-choco/45 text-right">{insumo?.unit || ""}</span><button onClick={() => setForm({ ...form, costRecipe: form.costRecipe.filter((_, i) => i !== index) })} className="text-red-400 flex justify-center"><Trash2 size={15} /></button></div>; })}{form.costRecipe.length === 0 && <p className="text-xs text-choco/45">Agrega los ingredientes del lote para comenzar.</p>}</div></div> : <div><p className="text-sm font-semibold text-choco">Receta de producción actual</p><p className="text-xs text-choco/45 mt-1 mb-3">El costo usa las cantidades por unidad configuradas en Inventario. No se modifica desde esta pantalla.</p><div className="space-y-1.5">{b.lines.map((line, idx) => <div key={idx} className="flex justify-between gap-3 rounded-xl bg-crema px-3 py-2 text-xs"><span>{line.name} · {NUM(line.qty, 2)} {line.unit}</span><strong>{line.missingCost ? "Costo pendiente" : CLP(line.lineCost)}</strong></div>)}{b.lines.length === 0 && <p className="text-xs text-choco/45">Este producto aún no tiene receta de producción.</p>}</div></div>}

    <>{b.missingCosts?.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Costo incompleto. Falta registrar compra/precio de: <strong>{b.missingCosts.join(", ")}</strong>.</div>}<div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">{b.missingCosts?.length ? "Costo parcial" : "Costo total"}</p><p className="font-bold mt-1">{CLP(b.total)}</p></div><div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Ganancia</p><p className="font-bold text-caramelo mt-1">{b.missingCosts?.length ? "—" : CLP(profit)}</p></div><div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Margen</p><p className="font-bold mt-1">{b.missingCosts?.length ? "—" : `${NUM(margin, 1)}%`}</p></div><div className="rounded-xl bg-crema p-3"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Ingredientes</p><p className="font-bold mt-1">{CLP(b.ingredients)}</p></div></div></>
    <div className="flex justify-end gap-2 pt-2 border-t border-oro/15"><button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-oro/20 bg-white text-sm font-semibold">Cancelar</button><button onClick={save} className="px-4 py-2.5 rounded-xl bg-choco text-crema text-sm font-semibold flex items-center gap-2"><Save size={15} /> Guardar costos</button></div>
  </div></Modal>;
}

// ============================================================
// Inventario
// ============================================================
function InventarioTab({ products, insumos, productions, movements, onSaveProducts, onSaveInsumos, onProduce, onAdjust }) {
  const [sub, setSub] = usePersistentView("inventarioSub", "productos");
  return <div><div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">{[["productos", "Stock productos"], ["insumos", "Insumos"], ["produccion", "Producción"], ["ajustes", "Mermas y ajustes"], ["movimientos", "Movimientos"]].map(([value, label]) => <button key={value} onClick={() => setSub(value)} className={"px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap " + (sub === value ? "bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98]" : "bg-white border border-oro/25 text-choco/70")}>{label}</button>)}</div>{sub === "productos" && <ProductosInventario products={products} insumos={insumos} onSave={onSaveProducts} onProduce={onProduce} />}{sub === "insumos" && <InsumosInventario insumos={insumos} onSave={onSaveInsumos} />}{sub === "produccion" && <ProduccionHistorial productions={productions} />}{sub === "ajustes" && <InventoryAdjustment products={products} insumos={insumos} onAdjust={onAdjust} />}{sub === "movimientos" && <MovimientosHistorial movements={movements} />}</div>;
}

function InventoryAdjustment({ products, insumos, onAdjust }) {
  const [entityType, setEntityType] = useState("producto");
  const options = entityType === "producto" ? products.filter((p) => p.active !== false) : insumos.filter((i) => i.active !== false);
  const [entityId, setEntityId] = useState(products[0]?.id || "");
  const [movementType, setMovementType] = useState("merma");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => setEntityId(options[0]?.id || ""), [entityType]);
  async function submit() {
    const amount = asNumber(qty);
    if (amount <= 0) return;
    const ok = await onAdjust({ entityType, entityId, delta: movementType === "merma" ? -amount : amount, reason });
    if (ok) { setQty(""); setReason(""); }
  }
  const selected = options.find((item) => item.id === entityId);
  return <div className="grid lg:grid-cols-2 gap-4"><Card className="p-4 space-y-3"><div><p className="font-semibold text-choco-dark">Registrar merma o corrección</p><p className="text-xs text-choco/45 mt-1">Usa este registro para productos dañados, vencidos, pérdidas o diferencias de conteo.</p></div><div className="grid grid-cols-2 gap-2"><Field label="Tipo de inventario"><SelectInput value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-full"><option value="producto">Producto terminado</option><option value="insumo">Insumo</option></SelectInput></Field><Field label="Movimiento"><SelectInput value={movementType} onChange={(e) => setMovementType(e.target.value)} className="w-full"><option value="merma">Merma / salida</option><option value="ajuste">Ajuste positivo</option></SelectInput></Field></div><Field label="Elemento"><SelectInput value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-full">{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput></Field><Field label={`Cantidad (${entityType === "producto" ? "unid" : selected?.unit || ""})`}><TextInput type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full" /></Field><Field label="Motivo obligatorio"><TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ej: 3 unidades dañadas durante el traslado" className="w-full" /></Field><button disabled={!entityId || asNumber(qty) <= 0 || !reason.trim()} onClick={submit} className="w-full py-2.5 bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] rounded-lg disabled:opacity-40">Registrar movimiento</button></Card><Card className="p-4 h-fit"><p className="text-sm font-semibold text-choco/80">Stock actual</p><p className="text-2xl font-bold text-choco mt-2">{NUM(selected?.stock, 1)} {entityType === "producto" ? "unid." : selected?.unit}</p><p className="text-xs text-choco/45 mt-1">El sistema nunca permitirá que el ajuste deje el stock bajo cero.</p></Card></div>;
}

function CatalogoProductos({ products, onSave, onBack }) {
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [form, setForm] = useState({ name: "", price: "", category: "", image: "", publicDescription: "", trackStock: getBusinessProfile().industry !== "servicios" });
  const active = products.filter((p) => p.active !== false);
  const archived = products.filter((p) => p.active === false);
  const visible = showArchived ? archived : active;

  function openNew() {
    setEditingId(null);
    setImageError("");
    setForm({ name: "", price: "", category: "", image: "", publicDescription: "", trackStock: getBusinessProfile().industry !== "servicios" });
    setOpen(true);
  }

  function openEdit(product) {
    setEditingId(product.id);
    setImageError("");
    setForm({ name: product.name || "", price: String(product.price || ""), category: product.category || "", image: product.image || "", publicDescription: product.publicDescription || "", trackStock: product.trackStock !== false });
    setOpen(true);
  }

  async function handleImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageBusy(true);
    setImageError("");
    try {
      const image = await compressProductImage(file);
      setForm((current) => ({ ...current, image }));
    } catch (error) {
      setImageError(error?.message || "No fue posible agregar la imagen.");
    } finally {
      setImageBusy(false);
    }
  }

  async function save() {
    if (!form.name.trim() || asNumber(form.price) <= 0) return;
    const patch = { name: form.name.trim(), price: asNumber(form.price), category: form.category.trim() || "Otros", image: form.image || "", publicDescription: form.publicDescription.trim().slice(0,800), trackStock: form.trackStock !== false };
    if (editingId) { if (await onSave(products.map((p) => p.id === editingId ? { ...p, ...patch } : p)) === false) return false; }
    else { if (await onSave([...products, { id: uid("prod"), active: true, stock: 0, minStock: 0, laborCost: 0, otherCost: 0, recipe: [], ...patch }]) === false) return false; }
    setOpen(false);
  }

  async function archive(id) { { if (await onSave(products.map((p) => p.id === id ? { ...p, active: false } : p)) === false) return false; } setConfirmingId(null); }
  async function restore(id) { { if (await onSave(products.map((p) => p.id === id ? { ...p, active: true } : p)) === false) return false; } }

  return <div>
    <div className="flex items-center justify-between gap-3 mb-4"><button onClick={onBack} className="text-sm font-semibold text-caramelo">← Productos</button><div className="flex gap-2">{archived.length > 0 && <button onClick={() => setShowArchived(!showArchived)} className="min-h-10 px-3 rounded-xl border border-oro/20 bg-white text-xs font-semibold">{showArchived ? "Ver activos" : `Archivados (${archived.length})`}</button>}<button onClick={openNew} className="min-h-10 px-3.5 rounded-xl bg-choco text-crema text-sm font-semibold flex items-center gap-1.5"><Plus size={15} /> Nuevo producto</button></div></div>

    {open && <Modal title={editingId ? "Editar producto" : "Nuevo producto"} onClose={() => setOpen(false)}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-choco/55 mb-1.5">Foto del producto</p>
          <div className="rounded-[20px] border border-oro/15 bg-crema/45 overflow-hidden">
            <div className="aspect-[16/10] flex items-center justify-center bg-crema/55 overflow-hidden">
              {form.image ? <img src={form.image} alt="Vista previa del producto" className="w-full h-full object-cover" /> : <div className="text-center text-choco/30"><Package size={38} strokeWidth={1.25} className="mx-auto" /><p className="text-xs mt-2">Sin foto</p></div>}
            </div>
            <div className="p-3 flex items-center gap-2">
              <label className={"flex-1 min-h-11 rounded-xl border border-oro/20 bg-white text-sm font-semibold text-choco flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] " + (imageBusy ? "opacity-50 pointer-events-none" : "")}>
                {imageBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {imageBusy ? "Preparando foto..." : form.image ? "Cambiar foto" : "Elegir foto"}
                <input type="file" accept="image/*" onChange={handleImage} className="sr-only" />
              </label>
              {form.image && <button type="button" onClick={() => setForm((current) => ({ ...current, image: "" }))} className="min-h-11 px-3 rounded-xl border border-red-100 bg-white text-red-500 text-xs font-semibold">Quitar</button>}
            </div>
          </div>
          <p className="text-[11px] text-choco/40 mt-1.5">En iPhone puedes elegirla desde Fotos o tomar una nueva. La app la reduce automáticamente para no guardar archivos pesados.</p>
          {imageError && <p className="text-xs text-red-600 mt-1.5">{imageError}</p>}
        </div>

        <Field label="Nombre"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Precio"><TextInput type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full" /></Field><Field label="Categoría"><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full" /></Field></div>
        <Field label="Descripción para la página pública"><textarea maxLength={800} rows={3} value={form.publicDescription} onChange={e=>setForm({...form,publicDescription:e.target.value})} className="w-full rounded-xl border border-oro/20 p-3 text-base" placeholder="Materiales, medidas o detalles que tus clientes deberían conocer."/></Field>
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={form.trackStock !== false} onChange={e => setForm({ ...form, trackStock: e.target.checked })} className="mt-1"/><span>Este producto controla existencias<small className="block text-xs text-choco/50 mt-1">Desactívalo para servicios o productos sin stock físico.</small></span></label>
        <button onClick={save} disabled={imageBusy || !form.name.trim() || asNumber(form.price) <= 0} className="w-full min-h-12 rounded-xl bg-choco text-crema font-semibold disabled:opacity-40"><Save size={15} className="inline mr-1" /> Guardar</button>
      </div>
    </Modal>}

    {visible.length === 0 ? <EmptyState>{showArchived ? "No hay productos archivados." : "No hay productos activos."}</EmptyState> : <div className="space-y-2">{visible.map((product) => <Card key={product.id} className="p-3 flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><div className="w-16 h-16 rounded-2xl bg-crema/60 border border-oro/10 overflow-hidden flex items-center justify-center shrink-0">{product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <Package size={22} strokeWidth={1.3} className="text-choco/25" />}</div><div className="min-w-0"><p className="font-semibold text-choco truncate">{product.name}</p><p className="text-sm text-caramelo mt-0.5">{CLP(product.price)}</p><p className="text-xs text-choco/40">{product.category || "Otros"}</p></div></div><div className="flex gap-2 shrink-0">{showArchived ? <button onClick={() => restore(product.id)} className="min-h-10 px-3 rounded-xl border border-oro/20 text-xs font-semibold"><RotateCcw size={14} className="inline mr-1" /> Restaurar</button> : <><button aria-label={`Editar ${product.name}`} onClick={() => openEdit(product)} className="w-10 h-10 rounded-xl border border-oro/20 flex items-center justify-center"><Pencil size={15} /></button>{confirmingId === product.id ? <button onClick={() => archive(product.id)} className="min-h-10 px-3 rounded-xl bg-red-600 text-white text-xs font-semibold">Confirmar</button> : <button onClick={() => setConfirmingId(product.id)} className="w-10 h-10 rounded-xl border border-red-200 text-red-500 flex items-center justify-center"><Trash2 size={15} /></button>}</>}</div></Card>)}</div>}
  </div>;
}

function emptyProductForm() { return { name: "", price: "", category: "", minStock: "5", laborCost: "", otherCost: "", recipe: [] }; }

function ProductosInventario({ products, insumos, onSave, onProduce }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProductForm());
  const [produceQty, setProduceQty] = useState({});
  const [busy, setBusy] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);

  const activeProducts = products.filter((p) => p.active !== false);
  const archivedProducts = products.filter((p) => p.active === false);
  const visibleProducts = showArchived ? archivedProducts : activeProducts;
  const availableInsumos = insumos.filter((i) => i.active !== false);

  function openEdit(product) {
    setEditingId(product.id);
    setForm({ name: product.name, price: String(product.price), category: product.category, minStock: String(product.minStock || 0), laborCost: String(product.laborCost || 0), otherCost: String(product.otherCost || 0), recipe: product.recipe || [] });
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim() || asNumber(form.price) <= 0) return;
    const data = { name: form.name.trim(), price: asNumber(form.price), category: form.category.trim() || "Otros", minStock: asNumber(form.minStock), laborCost: asNumber(form.laborCost), otherCost: asNumber(form.otherCost), recipe: form.recipe };
    if (editingId) { if (await onSave(products.map((p) => p.id === editingId ? { ...p, ...data } : p)) === false) return false; }
    else { if (await onSave([...products, { id: uid("prod"), active: true, stock: 0, ...data }]) === false) return false; }
    setModalOpen(false);
  }

  async function archiveProduct(id) {
    { if (await onSave(products.map((p) => p.id === id ? { ...p, active: false } : p)) === false) return false; }
    setConfirmingId(null);
  }

  async function restoreProduct(id) {
    { if (await onSave(products.map((p) => p.id === id ? { ...p, active: true } : p)) === false) return false; }
  }

  return <div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
      <div><p className="text-sm text-choco/60">Crea, edita o elimina productos sin tocar el historial de ventas.</p><p className="text-xs text-choco/40 mt-0.5">“Eliminar” los archiva de forma segura y puedes restaurarlos cuando quieras.</p></div>
      <div className="flex flex-wrap gap-2">
        {archivedProducts.length > 0 && <button onClick={() => setShowArchived(!showArchived)} className="min-h-11 px-3.5 rounded-xl border border-oro/25 bg-white text-sm font-medium text-choco hover:bg-crema transition-colors">{showArchived ? "Ver activos" : `Eliminados (${archivedProducts.length})`}</button>}
        <button onClick={() => { setEditingId(null); setForm(emptyProductForm()); setModalOpen(true); }} className="min-h-11 flex items-center gap-1.5 px-4 rounded-xl bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] text-sm font-medium"><Plus size={16} /> Nuevo producto</button>
      </div>
    </div>
    {modalOpen && <Modal title={editingId ? "Editar producto" : "Nuevo producto"} onClose={() => setModalOpen(false)} wide><div className="space-y-3"><div className="grid sm:grid-cols-3 gap-2"><Field label="Nombre"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" /></Field><Field label="Precio"><TextInput value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" className="w-full" /></Field><Field label="Categoría"><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full" /></Field><Field label="Stock mínimo"><TextInput value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} type="number" className="w-full" /></Field><Field label="Mano de obra por unidad"><TextInput value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} type="number" className="w-full" /></Field><Field label="Otros costos por unidad"><TextInput value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} type="number" className="w-full" /></Field></div><div className="border-t pt-3"><div className="flex items-center justify-between mb-2"><div><p className="text-xs font-semibold text-choco/60">Receta por unidad</p><p className="text-[11px] text-choco/45">Estos insumos se descuentan al producir.</p></div><button onClick={() => availableInsumos.length && setForm({ ...form, recipe: [...form.recipe, { insumoId: availableInsumos[0].id, qty: 0 }] })} className="min-h-10 px-2 text-xs font-medium text-caramelo"><Plus size={13} className="inline" /> Agregar</button></div><div className="space-y-2">{form.recipe.map((row, index) => <div key={index} className="flex gap-2"><SelectInput value={row.insumoId} onChange={(e) => setForm({ ...form, recipe: form.recipe.map((r, i) => i === index ? { ...r, insumoId: e.target.value } : r) })} className="flex-1">{insumos.filter((i) => i.active !== false || i.id === row.insumoId).map((i) => <option key={i.id} value={i.id}>{i.name}{i.active === false ? " (eliminado)" : ""}</option>)}</SelectInput><TextInput type="number" value={row.qty} onChange={(e) => setForm({ ...form, recipe: form.recipe.map((r, i) => i === index ? { ...r, qty: asNumber(e.target.value) } : r) })} className="w-24" /><button aria-label="Quitar ingrediente" onClick={() => setForm({ ...form, recipe: form.recipe.filter((_, i) => i !== index) })} className="min-w-10 min-h-10 flex items-center justify-center text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button></div>)}</div></div><div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-t pt-3"><p className="text-sm">Costo calculado: <strong className="text-choco">{CLP(productUnitCost(form, insumos))}</strong></p><button onClick={handleSubmit} className="min-h-11 px-4 rounded-lg bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] text-sm font-medium"><Save size={15} className="inline mr-1" /> Guardar producto</button></div></div></Modal>}

    {visibleProducts.length === 0 ? <EmptyState>{showArchived ? "No hay productos eliminados." : "No hay productos activos."}</EmptyState> : <div className="space-y-2">{visibleProducts.map((product) => { const unitCost = productUnitCost(product, insumos); const margin = product.price > 0 ? ((product.price - unitCost) / product.price) * 100 : 0; return <Card key={product.id} className="p-4"><div className="flex items-start justify-between gap-3 flex-wrap"><div className="flex-1 min-w-0"><div className="flex gap-2 items-center flex-wrap"><p className="font-semibold">{product.name}</p><Badge color="stone">{product.category}</Badge>{!showArchived && product.stock <= product.minStock && <Badge color={product.stock <= 0 ? "red" : "amber"}>{product.stock <= 0 ? "Sin stock" : "Stock bajo"}</Badge>}{showArchived && <Badge color="stone">Eliminado</Badge>}</div><p className="text-sm text-caramelo mt-1">Venta {CLP(product.price)} · costo {CLP(unitCost)} · margen {NUM(margin)}%</p><p className="text-xs text-choco/45">Stock {NUM(product.stock)} / mínimo {NUM(product.minStock)}</p><div className="max-w-xs"><StockBar stock={product.stock} min={product.minStock} /></div></div><div className="flex flex-wrap gap-2">{showArchived ? <button onClick={() => restoreProduct(product.id)} className="min-h-10 px-3 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50"><RotateCcw size={14} className="inline mr-1" /> Restaurar</button> : <>{<button onClick={() => openEdit(product)} className="min-h-10 px-3 rounded-lg border border-oro/25 text-choco/70 text-xs font-semibold hover:bg-crema"><Pencil size={14} className="inline mr-1" /> Editar</button>}{confirmingId === product.id ? <><button onClick={() => archiveProduct(product.id)} className="min-h-10 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold">Confirmar eliminar</button><button onClick={() => setConfirmingId(null)} className="min-h-10 px-3 rounded-lg border border-oro/25 text-xs text-choco/60">Cancelar</button></> : <button onClick={() => setConfirmingId(product.id)} className="min-h-10 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"><Trash2 size={14} className="inline mr-1" /> Eliminar</button>}</>}</div></div>{!showArchived && <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t"><TextInput type="number" min="1" value={produceQty[product.id] || ""} onChange={(e) => setProduceQty({ ...produceQty, [product.id]: e.target.value })} placeholder="Cantidad" className="w-28 py-2" /><button disabled={busy === product.id} onClick={async () => { setBusy(product.id); const ok = await onProduce(product.id, produceQty[product.id]); if (ok) setProduceQty({ ...produceQty, [product.id]: "" }); setBusy(null); }} className="min-h-10 flex items-center gap-1 px-3 rounded-lg bg-crema text-choco text-xs font-medium disabled:opacity-40">{busy === product.id ? <Loader2 size={13} className="animate-spin" /> : <Factory size={13} />} Producir</button></div>}</Card>; })}</div>}
  </div>;
}


function defaultFriendlyUnit(baseUnit) {
  const base = canonicalBaseUnit(baseUnit);
  if (base === "g") return "kg";
  if (base === "ml") return "l";
  return "unid";
}

function emptyInsumoForm(baseUnit = "g") {
  const base = canonicalBaseUnit(baseUnit);
  const friendly = defaultFriendlyUnit(base);
  return {
    name: "",
    unit: base,
    stockQty: "",
    stockUnit: friendly,
    minStockQty: "",
    minStockUnit: base,
    purchaseQty: "",
    purchaseUnit: friendly,
    totalPrice: "",
  };
}

function formFromInsumo(insumo) {
  const base = canonicalBaseUnit(insumo.unit);
  const friendly = defaultFriendlyUnit(base);
  const storedPurchaseUnit = insumo.referencePurchaseUnit || friendly;
  let purchaseQty = insumo.referencePurchaseQty ?? "";
  let totalPrice = insumo.referencePurchaseTotal ?? "";

  // Para insumos antiguos con costo válido pero sin formato guardado,
  // reconstruimos una referencia amigable sin cambiar el costo.
  if ((purchaseQty === "" || totalPrice === "") && hasConfiguredCost(insumo)) {
    if (base === "g") {
      purchaseQty = 1;
      totalPrice = asNumber(insumo.costPerUnit) * 1000;
    } else if (base === "ml") {
      purchaseQty = 1;
      totalPrice = asNumber(insumo.costPerUnit) * 1000;
    } else {
      purchaseQty = 1;
      totalPrice = asNumber(insumo.costPerUnit);
    }
  }

  return {
    name: insumo.name,
    unit: base,
    stockQty: String(insumo.stock ?? ""),
    stockUnit: base,
    minStockQty: String(insumo.minStock ?? ""),
    minStockUnit: base,
    purchaseQty: purchaseQty === "" ? "" : String(purchaseQty),
    purchaseUnit: storedPurchaseUnit,
    totalPrice: totalPrice === "" ? "" : String(Math.round(asNumber(totalPrice) * 100) / 100),
  };
}

function InsumosInventario({ insumos, onSave }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyInsumoForm());
  const [showArchived, setShowArchived] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);

  const activeInsumos = insumos.filter((i) => i.active !== false);
  const archivedInsumos = insumos.filter((i) => i.active === false);
  const sorted = [...(showArchived ? archivedInsumos : activeInsumos)].sort(
    (a, b) => Number(a.stock > a.minStock) - Number(b.stock > b.minStock)
  );

  const baseUnit = canonicalBaseUnit(form.unit);
  const stockUnitOptions = purchaseUnitOptions(baseUnit);
  const purchaseUnitOptionsForForm = purchaseUnitOptions(baseUnit);
  const stockInBase = convertPurchaseToBase(form.stockQty, form.stockUnit, baseUnit);
  const minStockInBase = convertPurchaseToBase(form.minStockQty, form.minStockUnit, baseUnit);
  const purchaseBaseQty = convertPurchaseToBase(form.purchaseQty, form.purchaseUnit, baseUnit);
  const calculatedUnitCost =
    purchaseBaseQty > 0 && asNumber(form.totalPrice) > 0
      ? asNumber(form.totalPrice) / purchaseBaseQty
      : 0;

  function resetUnitsForBase(nextBase) {
    const base = canonicalBaseUnit(nextBase);
    const friendly = defaultFriendlyUnit(base);
    setForm((current) => ({
      ...current,
      unit: base,
      stockUnit: friendly,
      minStockUnit: base,
      purchaseUnit: friendly,
      stockQty: "",
      minStockQty: "",
      purchaseQty: "",
      totalPrice: "",
    }));
  }

  async function submit() {
    if (!form.name.trim()) return;

    const current = editingId ? insumos.find((i) => i.id === editingId) : null;
    const hasNewCostReference = purchaseBaseQty > 0 && asNumber(form.totalPrice) > 0;
    const keepExistingCost = current && hasConfiguredCost(current) && !hasNewCostReference;

    const data = {
      name: form.name.trim(),
      unit: baseUnit,
      stock: Math.max(0, stockInBase),
      minStock: Math.max(0, minStockInBase),
      costPerUnit: hasNewCostReference
        ? calculatedUnitCost
        : keepExistingCost
          ? asNumber(current.costPerUnit)
          : 0,
      costSource: hasNewCostReference
        ? "manual"
        : keepExistingCost
          ? current.costSource
          : "pending",
      referencePurchaseQty: hasNewCostReference ? asNumber(form.purchaseQty) : current?.referencePurchaseQty,
      referencePurchaseUnit: hasNewCostReference ? form.purchaseUnit : current?.referencePurchaseUnit,
      referencePurchaseTotal: hasNewCostReference ? asNumber(form.totalPrice) : current?.referencePurchaseTotal,
      costUpdatedAt: hasNewCostReference ? new Date().toISOString() : current?.costUpdatedAt,
    };

    if (editingId) {
      { if (await onSave(insumos.map((i) => (i.id === editingId ? { ...i, ...data } : i))) === false) return false; }
    } else {
      { if (await onSave([...insumos, { id: uid("ins"), active: true, ...data }]) === false) return false; }
    }
    setModalOpen(false);
  }

  async function archiveInsumo(id) {
    { if (await onSave(insumos.map((i) => (i.id === id ? { ...i, active: false } : i))) === false) return false; }
    setConfirmingId(null);
  }

  async function restoreInsumo(id) {
    { if (await onSave(insumos.map((i) => (i.id === id ? { ...i, active: true } : i))) === false) return false; }
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyInsumoForm("g"));
    setModalOpen(true);
  }

  function openEdit(insumo) {
    setEditingId(insumo.id);
    setForm(formFromInsumo(insumo));
    setModalOpen(true);
  }

  return <div>
    <Card className="p-4 mb-3 border border-emerald-200/70 bg-emerald-50/60 shadow-none">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0"><Check size={18} /></span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-choco">Inventario iniciado el 15-08-2026</p>
            <Badge color="emerald">Corte inicial</Badge>
          </div>
          <p className="text-xs text-choco/55 mt-1">Este apartado parte desde el conteo físico real informado. Las ventas, pedidos, clientes y finanzas anteriores se mantienen.</p>
        </div>
      </div>
    </Card>

    <Card className="p-4 mb-4 bg-crema/40 shadow-none">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-white border border-oro/15 flex items-center justify-center text-caramelo shrink-0"><CircleDollarSign size={18} /></span>
        <div>
          <p className="font-semibold text-choco">Stock y costo en un solo lugar</p>
          <p className="text-xs text-choco/50 mt-1">No necesitas registrar una compra aparte. Cuando repongas un insumo, entra a <strong>Editar</strong>, actualiza cuánto tienes y el precio del formato comprado.</p>
          <p className="text-xs text-choco/50 mt-1">La app entiende kg ↔ g, litros ↔ ml y docenas ↔ unidades. Ejemplo: 1 kg a $7.990 = $7,99/g; si la receta usa 14 g, calcula aprox. $112.</p>
        </div>
      </div>
    </Card>

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
      <div>
        <p className="text-sm text-choco/60">Aquí administras existencia, precio de referencia y costo por receta.</p>
        <p className="text-xs text-choco/40 mt-0.5">Si el precio cambia, solo reemplaza el valor de referencia. No se crea un registro de compra.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {archivedInsumos.length > 0 && <button onClick={() => setShowArchived(!showArchived)} className="min-h-11 px-3.5 rounded-xl border border-oro/25 bg-white text-sm font-medium text-choco hover:bg-crema transition-colors">{showArchived ? "Ver activos" : `Eliminados (${archivedInsumos.length})`}</button>}
        <button onClick={openNew} className="min-h-11 flex items-center gap-1.5 px-4 rounded-xl bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] text-sm font-medium"><Plus size={16} /> Nuevo insumo</button>
      </div>
    </div>

    {modalOpen && <Modal title={editingId ? "Editar insumo" : "Nuevo insumo"} onClose={() => setModalOpen(false)} wide>
      <div className="space-y-5">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-choco/40 mb-2">Insumo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre">
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" />
            </Field>
            <Field label="Unidad base de las recetas">
              <SelectInput value={form.unit} onChange={(e) => resetUnitsForBase(e.target.value)} className="w-full">
                {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </SelectInput>
            </Field>
          </div>
          <p className="text-xs text-choco/45 mt-2">Usa g si las recetas se expresan en gramos, ml para líquidos y unid. para huevos, bolsas, stickers, etc.</p>
        </section>

        <section className="rounded-2xl border border-oro/15 bg-crema/35 p-4">
          <div className="mb-3">
            <p className="font-semibold text-choco">Stock actual</p>
            <p className="text-xs text-choco/45 mt-0.5">Puedes escribir el stock en kg o g (o litros/ml). La app lo guarda en la unidad base.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Field label="Cantidad que tienes">
                <TextInput type="number" inputMode="decimal" step="any" min="0" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} className="w-full" placeholder="Ej. 1,2" />
              </Field>
              <Field label="Unidad">
                <SelectInput value={form.stockUnit} onChange={(e) => setForm({ ...form, stockUnit: e.target.value })} className="w-full">
                  {stockUnitOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Field label="Avisarme bajo">
                <TextInput type="number" inputMode="decimal" step="any" min="0" value={form.minStockQty} onChange={(e) => setForm({ ...form, minStockQty: e.target.value })} className="w-full" placeholder="Ej. 500" />
              </Field>
              <Field label="Unidad">
                <SelectInput value={form.minStockUnit} onChange={(e) => setForm({ ...form, minStockUnit: e.target.value })} className="w-full">
                  {stockUnitOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          {stockInBase > 0 && form.stockUnit !== baseUnit && <p className="text-xs text-choco/50 mt-2">Se guardará como <strong>{NUM(stockInBase, 2)} {baseUnit}</strong>.</p>}
        </section>

        {insumos.find((i) => i.id === editingId)?.kind === "semielaborado" ? (
          <Card className="p-3 bg-stone-50 shadow-none">
            <p className="text-sm font-medium text-choco">Semielaborado</p>
            <p className="text-xs text-choco/50 mt-1">Por ahora administra solo su stock. Su costo puede venir después desde la receta o producción correspondiente.</p>
          </Card>
        ) : (
          <section className="rounded-2xl border border-caramelo/20 bg-white p-4">
            <div className="mb-3">
              <p className="font-semibold text-choco">Precio de referencia</p>
              <p className="text-xs text-choco/45 mt-0.5">Indica el formato que compras y cuánto cuesta. Cuando el precio cambie, reemplazas estos datos.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Cantidad del formato">
                <TextInput type="number" inputMode="decimal" step="any" min="0" value={form.purchaseQty} onChange={(e) => setForm({ ...form, purchaseQty: e.target.value })} className="w-full" placeholder="Ej. 1" />
              </Field>
              <Field label="Unidad del formato">
                <SelectInput value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} className="w-full">
                  {purchaseUnitOptionsForForm.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="Precio del formato">
                <TextInput type="number" inputMode="numeric" min="0" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} className="w-full" placeholder="Ej. 7990" />
              </Field>
            </div>

            <div className="mt-3 rounded-xl bg-crema/60 border border-oro/10 px-3 py-3">
              {calculatedUnitCost > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                  <span className="text-choco/55">Costo que usará la app</span>
                  <strong className="text-choco">{CLP(calculatedUnitCost)} por {baseUnit}</strong>
                </div>
              ) : (
                <p className="text-xs text-choco/45">Completa cantidad, unidad y precio para calcular el costo por {baseUnit}.</p>
              )}
            </div>
          </section>
        )}

        <button onClick={submit} className="w-full min-h-12 bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] rounded-xl font-semibold">
          <Save size={16} className="inline mr-1" /> Guardar insumo
        </button>
      </div>
    </Modal>}

    {sorted.length === 0 ? <EmptyState>{showArchived ? "No hay insumos eliminados." : "No hay insumos activos."}</EmptyState> : (
      <div className="space-y-2">
        {sorted.map((insumo) => {
          const configured = hasConfiguredCost(insumo);
          const refQty = insumo.referencePurchaseQty;
          const refUnit = insumo.referencePurchaseUnit;
          const refTotal = insumo.referencePurchaseTotal;
          return <Card key={insumo.id} className="p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
              <div className="flex-1">
                <div className="flex gap-2 items-center flex-wrap">
                  <p className="font-semibold">{insumo.name}</p>
                  {insumo.kind === "semielaborado" && <Badge color="stone">Semielaborado</Badge>}
                  {showArchived ? <Badge color="stone">Eliminado</Badge> : insumo.stock <= insumo.minStock && <Badge color={insumo.stock <= 0 ? "red" : "amber"}>{insumo.stock <= 0 ? "Sin stock" : "Stock bajo"}</Badge>}
                  {!showArchived && !configured && insumo.kind !== "semielaborado" && <Badge color="amber">Costo pendiente</Badge>}
                </div>
                <p className="text-sm text-choco/60 mt-1">
                  Stock <strong>{NUM(insumo.stock, 1)} {insumo.unit}</strong> · mínimo {NUM(insumo.minStock, 1)} {insumo.unit}
                </p>
                <p className="text-sm text-choco/60">
                  {configured ? <>Costo receta: <strong>{CLP(insumo.costPerUnit)} por {insumo.unit}</strong></> : insumo.kind === "semielaborado" ? <>Costo del semielaborado pendiente</> : <>Sin precio configurado</>}
                </p>
                {refQty && refUnit && refTotal ? <p className="text-xs text-choco/45 mt-0.5">Referencia: {NUM(refQty, 2)} {refUnit} = {CLP(refTotal)}</p> : null}
                <div className="max-w-xs"><StockBar stock={insumo.stock} min={insumo.minStock} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {showArchived ? (
                  <button onClick={() => restoreInsumo(insumo.id)} className="min-h-10 px-3 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50"><RotateCcw size={14} className="inline mr-1" /> Restaurar</button>
                ) : (
                  <>
                    <button onClick={() => openEdit(insumo)} className="min-h-10 px-3 rounded-lg bg-choco text-crema text-xs font-semibold hover:bg-choco-dark"><Pencil size={14} className="inline mr-1" /> Editar stock y costo</button>
                    {confirmingId === insumo.id ? (
                      <>
                        <button onClick={() => archiveInsumo(insumo.id)} className="min-h-10 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold">Confirmar eliminar</button>
                        <button onClick={() => setConfirmingId(null)} className="min-h-10 px-3 rounded-lg border border-oro/25 text-xs text-choco/60">Cancelar</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmingId(insumo.id)} className="min-h-10 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"><Trash2 size={14} className="inline mr-1" /> Eliminar</button>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>;
        })}
      </div>
    )}
  </div>;
}

function ProduccionHistorial({ productions }) {
  return productions.length === 0 ? <EmptyState>No hay producciones registradas.</EmptyState> : <div className="space-y-2">{productions.map((production) => <Card key={production.id} className="p-4 flex justify-between gap-3"><div><p className="font-semibold">{production.productName}</p><p className="text-xs text-choco/45">{fmtDate(production.dateISO)}</p></div><div className="text-right"><p className="font-bold text-choco">{NUM(production.qty)} unid.</p><p className="text-xs text-choco/45">Costo lote {CLP(production.totalCost)}</p></div></Card>)}</div>;
}

function MovimientosHistorial({ movements }) {
  const [search, setSearch] = useState("");
  const filtered = movements.filter((m) => `${m.name} ${m.type} ${m.note}`.toLowerCase().includes(search.toLowerCase()));
  return <div><div className="relative mb-4"><Search size={15} className="absolute left-3 top-3 text-choco/45" /><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar movimiento..." className="w-full pl-9" /></div>{filtered.length === 0 ? <EmptyState>No hay movimientos.</EmptyState> : <div className="space-y-2">{filtered.slice(0, 300).map((movement) => <Card key={movement.id} className="p-3 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{movement.name}</p><p className="text-xs text-choco/45">{movement.type} · {fmtDate(movement.dateISO)}</p>{movement.note && <p className="text-xs text-choco/60">{movement.note}</p>}</div><p className={`font-semibold ${movement.qty < 0 ? "text-red-600" : "text-caramelo"}`}>{movement.qty > 0 ? "+" : ""}{NUM(movement.qty, 1)} {movement.unit}</p></Card>)}</div>}</div>;
}

// ============================================================
// Finanzas, gastos, proveedores y presupuesto
// ============================================================
function FinanzasTab({ sales, expenses, suppliers, insumos, budgets, onAddExpense, onDeleteExpense, onPayExpense, onSaveSuppliers, onSaveBudgets }) {
  const [sub, setSub] = usePersistentView("finanzasSub", "resumen");
  return <div><div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">{[["resumen", "Resumen"], ["gastos", "Gastos"], ["proveedores", "Proveedores"], ["presupuesto", "Presupuesto"]].map(([value, label]) => <button key={value} onClick={() => setSub(value)} className={"px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap " + (sub === value ? "bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98]" : "bg-white border border-oro/25 text-choco/70")}>{label}</button>)}</div>{sub === "resumen" && <FinanceSummary sales={sales} expenses={expenses} />}{sub === "gastos" && <ExpensesManager expenses={expenses} suppliers={suppliers} insumos={insumos} onAdd={onAddExpense} onDelete={onDeleteExpense} onPay={onPayExpense} />}{sub === "proveedores" && <SuppliersManager suppliers={suppliers} onSave={onSaveSuppliers} />}{sub === "presupuesto" && <BudgetManager budgets={budgets} sales={sales} expenses={expenses} onSave={onSaveBudgets} />}</div>;
}

function FinanceSummary({ sales, expenses }) {
  const date = new Date(), to = localDay(date), from = `${to.slice(0,7)}-01`;
  const metric = financialSummary(sales, expenses, { from, to });
  return <div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><KPI icon={DollarSign} label="Ventas del mes" value={CLP(metric.billed)} /><KPI icon={CreditCard} label="Cobros del mes" value={CLP(metric.collected)} helper="Según fecha de cada abono" /><KPI icon={Receipt} label="Gastos pagados" value={CLP(metric.paidExpenses)} tone="amber" /><KPI icon={TrendingUp} label="Flujo registrado" value={CLP(metric.cashFlow)} helper="Cobros − pagos del mes" /></div>{metric.undatedCollections > 0 && <p className="mt-3 text-xs text-choco/60">Hay {CLP(metric.undatedCollections)} en cobros históricos sin fecha. Se conservan en los saldos, pero no se asignan a este mes.</p>}</div>;
}

function ExpensesManager({ expenses, suppliers, insumos, onAdd, onDelete, onPay }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = expenses.filter((e) => `${e.description} ${e.supplierName} ${e.category}`.toLowerCase().includes(search.toLowerCase()));
  function exportExpenses() {
    downloadCSV(`gastos_${todayDate()}.csv`, [["Fecha", "Tipo", "Categoría", "Proveedor", "Descripción", "Total", "Pago", "Documento"], ...filtered.map((e) => [fmtDate(e.dateISO, false), e.type, e.category, e.supplierName, e.description, e.total, e.paymentMethod, e.documentNumber])]);
  }
  return <div><div className="flex flex-col lg:flex-row gap-3 mb-4"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-choco/45" /><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar gasto..." className="w-full pl-9" /></div><button onClick={exportExpenses} className="px-4 py-2.5 rounded-xl border border-oro/25 bg-white text-sm flex items-center justify-center gap-1 text-choco hover:bg-crema transition-colors"><Download size={15} /> CSV</button><button onClick={() => setModal("compra")} className="px-4 py-2.5 rounded-xl border border-oro/25 bg-white text-sm flex items-center justify-center gap-1"><PackagePlus size={15} /> Comprar insumos</button><button onClick={() => setModal("gasto")} className="px-4 py-2.5 rounded-xl bg-caramelo text-white text-sm flex items-center justify-center gap-1"><Receipt size={15} /> Registrar gasto</button></div>{modal === "compra" && <PurchaseModal suppliers={suppliers} insumos={insumos} onClose={() => setModal(null)} onSave={async (data, lines) => { if (await onAdd(data, lines)) setModal(null); }} />}{modal === "gasto" && <GeneralExpenseModal suppliers={suppliers} onClose={() => setModal(null)} onSave={async (data) => { if (await onAdd(data)) setModal(null); }} />}{filtered.length === 0 ? <EmptyState>No hay gastos o compras registrados.</EmptyState> : <div className="space-y-2">{filtered.map((expense) => <Card key={expense.id} className="p-4 flex items-start justify-between gap-3"><div><div className="flex gap-2 items-center"><p className="font-semibold">{expense.description}</p><Badge color={expense.type === "Compra" ? "emerald" : "amber"}>{expense.type}</Badge></div><p className="text-xs text-choco/45 mt-1">{fmtDate(expense.dateISO)} · {expense.category} · {expense.supplierName}</p><p className="text-xs text-choco/60">{expense.paymentMethod}{expense.documentNumber ? ` · Doc. ${expense.documentNumber}` : ""}</p>{expense.items?.length > 0 && <p className="text-xs text-choco/60 mt-1">{expense.items.map((line) => `${NUM(line.qty, 1)} ${insumos.find((i) => i.id === line.insumoId)?.unit || ""} ${insumos.find((i) => i.id === line.insumoId)?.name || ""}`).join(" · ")}</p>}</div><div className="flex items-center gap-2"><p className="font-bold text-choco">{CLP(expense.total)}</p>{expense.paymentStatus !== "Pagado" && <button onClick={() => onPay(expense.id)} className="px-2 py-1 rounded-lg bg-choco text-crema text-xs">Marcar pagado</button>}{expense.type !== "Compra" && <button aria-label="Eliminar gasto" onClick={() => { if(window.confirm("¿Eliminar este gasto?")) onDelete(expense.id); }} className="p-1.5 text-red-400"><Trash2 size={14} /></button>}</div></Card>)}</div>}</div>;
}

function GeneralExpenseModal({ suppliers, onClose, onSave }) {
  const [form, setForm] = useState({ date: todayDate(), category: "Otros", supplierId: "", supplierName: "", description: "", total: "", paymentMethod: "Transferencia", paymentStatus: "Pagado", documentNumber: "" });
  return <Modal title="Registrar gasto" onClose={onClose}><ExpenseFields form={form} setForm={setForm} suppliers={suppliers} /><button disabled={!form.description.trim() || asNumber(form.total) <= 0} onClick={() => onSave(form)} className="w-full mt-4 py-2.5 bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] rounded-lg disabled:opacity-40">Guardar gasto</button></Modal>;
}

function ExpenseFields({ form, setForm, suppliers, hideTotal = false }) {
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><Field label="Fecha"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full" /></Field><Field label="Categoría"><SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</SelectInput></Field><Field label="Proveedor"><SelectInput value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full"><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectInput></Field><Field label="Documento"><TextInput value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="Boleta o factura" className="w-full" /></Field><Field label="Método de pago"><SelectInput value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</SelectInput></Field><Field label="Estado"><SelectInput value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })} className="w-full"><option>Pagado</option><option>Pendiente</option></SelectInput></Field></div><Field label="Descripción"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full" /></Field>{!hideTotal && <Field label="Total"><TextInput type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} className="w-full" /></Field>}</div>;
}

function PurchaseModal({ suppliers, insumos, onClose, onSave }) {
  const activeInsumos = insumos.filter((i) => i.active !== false);
  const [form, setForm] = useState({ date: todayDate(), category: "Insumos", supplierId: "", supplierName: "", description: "Compra de insumos", paymentMethod: "Transferencia", paymentStatus: "Pagado", documentNumber: "" });
  const makeEmptyLine = (insumo = activeInsumos[0]) => {
    if (!insumo) return null;
    const opts = purchaseUnitOptions(canonicalBaseUnit(insumo.unit));
    return { insumoId: insumo.id, purchaseQty: "", purchaseUnit: opts[opts.length > 1 ? 1 : 0].value, totalPrice: "" };
  };
  const [lines, setLines] = useState(() => {
    const first = makeEmptyLine();
    return first ? [first] : [];
  });
  const normalizedLines = lines.map((line) => {
    const insumo = activeInsumos.find((i) => i.id === line.insumoId);
    const baseUnit = canonicalBaseUnit(insumo?.unit);
    const qty = convertPurchaseToBase(line.purchaseQty, line.purchaseUnit, baseUnit);
    const totalPrice = asNumber(line.totalPrice);
    return { ...line, qty, unitCost: qty > 0 ? totalPrice / qty : 0, totalPrice };
  });
  const total = normalizedLines.reduce((sum, line) => sum + asNumber(line.totalPrice), 0);
  const canSave = lines.length > 0 && !normalizedLines.some((line) => asNumber(line.qty) <= 0 || asNumber(line.totalPrice) <= 0);

  function updateLine(index, patch) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  }
  function addLine() {
    const next = makeEmptyLine();
    if (next) setLines((current) => [...current, next]);
  }
  function removeLine(index) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  return <Modal title="Registrar compra de insumos" onClose={onClose} extraWide>
    <div className="space-y-5">
      <Card className="p-4 sm:p-5 shadow-none bg-crema/35 border-oro/15">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="font-semibold text-choco-dark">Datos de la compra</p>
            <p className="text-xs text-choco/45 mt-0.5">Información general del comprobante y pago.</p>
          </div>
          <Badge color={form.paymentStatus === "Pagado" ? "emerald" : "amber"}>{form.paymentStatus}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Fecha"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full" /></Field>
          <Field label="Proveedor"><SelectInput value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full"><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectInput></Field>
          <Field label="Documento"><TextInput value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="Boleta o factura" className="w-full" /></Field>
          <Field label="Método de pago"><SelectInput value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</SelectInput></Field>
          <Field label="Estado"><SelectInput value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })} className="w-full"><option>Pagado</option><option>Pendiente</option></SelectInput></Field>
          <Field label="Categoría"><SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</SelectInput></Field>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Descripción"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full" /></Field></div>
        </div>
      </Card>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <p className="font-semibold text-choco-dark">Detalle de insumos</p>
            <p className="text-xs text-choco/45 mt-0.5">La app convierte automáticamente kg ↔ g, litros ↔ ml y docenas ↔ unidades.</p>
          </div>
          <button onClick={addLine} className="min-h-10 px-3.5 py-2 rounded-xl border border-caramelo/30 bg-caramelo/5 text-caramelo hover:bg-caramelo/10 transition-colors text-sm font-medium flex items-center justify-center gap-1.5 shrink-0"><Plus size={15} /> Agregar insumo</button>
        </div>

        {lines.length === 0 ? <div className="rounded-2xl border border-dashed border-oro/30 bg-crema/25 p-6 text-center">
          <PackagePlus size={24} className="mx-auto text-caramelo/60 mb-2" />
          <p className="text-sm font-medium text-choco">Agrega los insumos de esta compra</p>
          <p className="text-xs text-choco/45 mt-1">Puedes registrar varios productos en un mismo comprobante.</p>
          <button onClick={addLine} className="mt-3 px-4 py-2 rounded-xl bg-choco text-crema text-sm"><Plus size={14} className="inline mr-1" /> Agregar primer insumo</button>
        </div> : <div className="space-y-3">
          {lines.map((line, index) => {
            const insumo = activeInsumos.find((i) => i.id === line.insumoId);
            const baseUnit = canonicalBaseUnit(insumo?.unit);
            const opts = purchaseUnitOptions(baseUnit);
            const normalized = normalizedLines[index];
            return <Card key={index} className="p-4 shadow-none border-oro/20 overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-crema text-caramelo text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                  <p className="text-sm font-semibold text-choco truncate">{insumo?.name || "Insumo"}</p>
                </div>
                <button onClick={() => removeLine(index)} className="w-9 h-9 rounded-xl border border-red-200/70 text-red-400 hover:bg-red-50 transition-colors flex items-center justify-center shrink-0" title="Eliminar insumo"><Trash2 size={15} /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end min-w-0">
                <Field label="Insumo"><SelectInput value={line.insumoId} onChange={(e) => { const selected = activeInsumos.find((i) => i.id === e.target.value); const purchaseOptions = purchaseUnitOptions(canonicalBaseUnit(selected?.unit)); updateLine(index, { insumoId: e.target.value, purchaseUnit: purchaseOptions[purchaseOptions.length > 1 ? 1 : 0].value }); }} className="w-full min-w-0">{activeInsumos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</SelectInput></Field>
                <Field label="Cantidad comprada"><TextInput type="number" inputMode="decimal" step="any" min="0" value={line.purchaseQty} onChange={(e) => updateLine(index, { purchaseQty: e.target.value })} placeholder="Ej. 1" className="w-full min-w-0" /></Field>
                <Field label="Unidad de compra"><SelectInput value={line.purchaseUnit} onChange={(e) => updateLine(index, { purchaseUnit: e.target.value })} className="w-full min-w-0">{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectInput></Field>
                <Field label="Total pagado"><TextInput type="number" inputMode="numeric" min="0" value={line.totalPrice} onChange={(e) => updateLine(index, { totalPrice: e.target.value })} placeholder="Ej. 7990" className="w-full min-w-0" /></Field>
              </div>

              {normalized?.qty > 0 && normalized?.totalPrice > 0 ? <div className="mt-3 rounded-xl bg-crema/60 border border-oro/10 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-choco/60">
                <span>Equivale a <strong className="text-choco">{NUM(normalized.qty, 2)} {baseUnit}</strong></span>
                <span>Costo calculado: <strong className="text-choco">{CLP(normalized.unitCost)} por {baseUnit}</strong></span>
              </div> : <p className="mt-3 text-xs text-choco/40">Ingresa cantidad y total pagado para calcular el costo por {baseUnit || "unidad"}.</p>}
            </Card>;
          })}
        </div>}

        {lines.length > 0 && <button onClick={addLine} className="w-full mt-3 min-h-11 rounded-xl border border-dashed border-oro/35 text-caramelo hover:bg-crema/40 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"><Plus size={15} /> Agregar otro insumo</button>}
      </section>

      <div className="sticky bottom-[-1rem] sm:bottom-[-1.25rem] z-10 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white/95 backdrop-blur border-t border-oro/15 shadow-[0_-12px_28px_rgba(90,52,32,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 flex items-center justify-between sm:justify-start sm:gap-3">
            <div>
              <p className="text-xs text-choco/45">Total compra</p>
              <p className="text-2xl font-bold text-choco leading-tight">{CLP(total)}</p>
            </div>
            <Badge color="amber">{lines.length} {lines.length === 1 ? "insumo" : "insumos"}</Badge>
          </div>
          <button disabled={!canSave} onClick={() => onSave(form, normalizedLines)} className="w-full sm:w-auto sm:min-w-[250px] min-h-12 px-5 rounded-xl bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] font-medium disabled:opacity-40 flex items-center justify-center gap-2"><Save size={16} /> Guardar compra y reponer stock</button>
        </div>
        {!canSave && lines.length > 0 && <p className="text-[11px] text-choco/40 mt-2 sm:text-right">Completa la cantidad y el total pagado de todos los insumos para guardar.</p>}
      </div>
    </div>
  </Modal>;
}

function SuppliersManager({ suppliers, onSave }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  async function submit() {
    if (!form.name.trim()) return;
    if (editing) { if (await onSave(suppliers.map((s) => s.id === editing ? { ...s, ...form, name: form.name.trim() } : s)) === false) return false; }
    else { if (await onSave([...suppliers, { id: uid("prov"), ...form, name: form.name.trim(), createdAt: todayISO() }]) === false) return false; }
    setOpen(false);
  }
  return <div><div className="flex justify-end mb-4"><button onClick={() => { setEditing(null); setForm({ name: "", phone: "", email: "", notes: "" }); setOpen(true); }} className="px-4 py-2.5 rounded-xl bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] text-sm flex items-center gap-1"><Plus size={15} /> Nuevo proveedor</button></div>{open && <Modal title={editing ? "Editar proveedor" : "Nuevo proveedor"} onClose={() => setOpen(false)}><div className="space-y-3"><Field label="Nombre"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full" /></Field><div className="grid grid-cols-2 gap-2"><Field label="Teléfono"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full" /></Field><Field label="Correo"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full" /></Field></div><Field label="Notas"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full" /></Field><button onClick={submit} className="w-full py-2.5 bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] rounded-lg">Guardar proveedor</button></div></Modal>}{suppliers.length === 0 ? <EmptyState>No hay proveedores registrados.</EmptyState> : <div className="grid md:grid-cols-2 gap-3">{suppliers.map((supplier) => <Card key={supplier.id} className="p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold flex items-center gap-1"><Building2 size={14} /> {supplier.name}</p><p className="text-xs text-choco/60 mt-1">{supplier.phone || "Sin teléfono"}{supplier.email ? ` · ${supplier.email}` : ""}</p>{supplier.notes && <p className="text-xs text-choco/45 mt-1">{supplier.notes}</p>}</div><button onClick={() => { setEditing(supplier.id); setForm({ name: supplier.name, phone: supplier.phone || "", email: supplier.email || "", notes: supplier.notes || "" }); setOpen(true); }} className="p-1.5 border border-oro/25 rounded-lg h-fit text-choco/70 hover:bg-crema transition-colors"><Pencil size={14} /></button></div></Card>)}</div>}</div>;
}

function BudgetManager({ budgets, sales, expenses, onSave }) {
  const [month, setMonth] = useState(monthKey());
  const current = budgets[month] || { salesTarget: "", expenseLimit: "", investmentLimit: "" };
  const [form, setForm] = useState(current);
  useEffect(() => setForm(budgets[month] || { salesTarget: "", expenseLimit: "", investmentLimit: "" }), [month, budgets]);
  const actualSales = financialSummary(sales, expenses, { from: `${month}-01`, to: `${month}-31` }).collected;
  const actualExpenses = expenses.filter((e) => monthKey(new Date(e.dateISO)) === month).reduce((sum, e) => sum + asNumber(e.total), 0);
  return <div className="grid lg:grid-cols-2 gap-4"><Card className="p-4"><Field label="Mes"><TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full" /></Field><div className="grid sm:grid-cols-3 gap-2 mt-3"><Field label="Meta de ventas"><TextInput type="number" value={form.salesTarget || ""} onChange={(e) => setForm({ ...form, salesTarget: e.target.value })} className="w-full" /></Field><Field label="Límite de gastos"><TextInput type="number" value={form.expenseLimit || ""} onChange={(e) => setForm({ ...form, expenseLimit: e.target.value })} className="w-full" /></Field><Field label="Límite inversión"><TextInput type="number" value={form.investmentLimit || ""} onChange={(e) => setForm({ ...form, investmentLimit: e.target.value })} className="w-full" /></Field></div><button onClick={() => onSave({ ...budgets, [month]: { salesTarget: asNumber(form.salesTarget), expenseLimit: asNumber(form.expenseLimit), investmentLimit: asNumber(form.investmentLimit) } })} className="w-full mt-4 py-2.5 bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] rounded-lg">Guardar presupuesto</button></Card><Card className="p-4"><p className="font-semibold text-choco-dark mb-4">Resultado de {month}</p><div className="space-y-4"><ProgressMetric label="Ventas cobradas" actual={actualSales} target={asNumber(form.salesTarget)} reverse={false} /><ProgressMetric label="Gastos" actual={actualExpenses} target={asNumber(form.expenseLimit)} reverse /></div></Card></div>;
}

// ============================================================
// Gráficos
// ============================================================
function GraficosTab({ sales, expenses, products, insumos }) {
  const byProduct = useMemo(() => {
    const map = Object.create(null);
    sales.filter((s) => s.paymentStatus === "Pagado").forEach((sale) => sale.items.forEach((item) => { map[item.name] = (map[item.name] || 0) + asNumber(item.price) * asNumber(item.qty); }));
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [sales]);
  const byExpense = useMemo(() => {
    const map = Object.create(null);
    expenses.forEach((expense) => { map[expense.category] = (map[expense.category] || 0) + asNumber(expense.total); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);
  const byPaymentMethod = useMemo(() => {
    const map = Object.create(null);
    sales.forEach((sale) => {
      const key = sale.paymentMethod || "Otro";
      if (!map[key]) map[key] = { name: key, value: 0, count: 0 };
      map[key].value += asNumber(sale.total);
      map[key].count += 1;
    });
    const rows = Object.values(map).sort((a, b) => b.value - a.value);
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    return { rows, total };
  }, [sales]);
  const monthly = useMemo(() => {
    const result = [];
    for (let index = 5; index >= 0; index--) {
      const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - index);
      const key = monthKey(date);
      const metrics = financialSummary(sales, expenses, { from: `${key}-01`, to: localDay(new Date(date.getFullYear(),date.getMonth()+1,0)) });
      result.push({ month: key, ventas: metrics.billed, cobros: metrics.collected, flujo: metrics.cashFlow });
    }
    return result;
  }, [sales, expenses]);
  const stockProducts = products.map((p) => ({ name: p.name, stock: asNumber(p.stock), low: asNumber(p.stock) <= asNumber(p.minStock) }));
  const stockInsumos = insumos.map((i) => ({ name: i.name, pct: i.minStock > 0 ? Math.round((i.stock / i.minStock) * 100) : 100, low: i.stock <= i.minStock })).sort((a, b) => a.pct - b.pct);

  return <div className="grid lg:grid-cols-2 gap-4"><Card className="p-4 lg:col-span-2"><p className="text-sm font-semibold font-brand text-choco mb-3">Ventas y flujo registrado — últimos 6 meses</p><ResponsiveContainer width="100%" height={230}><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="month" /><YAxis tickFormatter={CLP} width={80} /><Tooltip formatter={CLP} /><Line isAnimationActive={false} type="monotone" dataKey="ventas" stroke="var(--ce-accent-text)" strokeWidth={2.5} /><Line isAnimationActive={false} type="monotone" dataKey="flujo" stroke="#8b5cf6" strokeWidth={2.5} /></LineChart></ResponsiveContainer></Card><Card className="p-4"><p className="text-sm font-semibold font-brand text-choco mb-3">Productos de ventas totalmente pagadas · antes de descuentos</p><ResponsiveContainer width="100%" height={260}><BarChart data={byProduct} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={CLP} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip formatter={CLP} /><Bar isAnimationActive={false} dataKey="total" fill="var(--ce-accent-text)" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></Card><Card className="p-4"><p className="text-sm font-semibold font-brand text-choco mb-3">Gastos por categoría</p>{byExpense.length ? <ResponsiveContainer width="100%" height={260}><PieChart><Pie isAnimationActive={false} data={byExpense} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(entry) => entry.name}>{byExpense.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={CLP} /></PieChart></ResponsiveContainer> : <p className="text-sm text-choco/45 py-20 text-center">Sin gastos registrados.</p>}</Card><Card className="p-4"><p className="text-sm font-semibold font-brand text-choco mb-3">Ventas por método de pago</p>{byPaymentMethod.rows.length ? <div className="grid sm:grid-cols-2 gap-3 items-center"><ResponsiveContainer width="100%" height={220}><PieChart><Pie isAnimationActive={false} data={byPaymentMethod.rows} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.name}>{byPaymentMethod.rows.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={CLP} /></PieChart></ResponsiveContainer><div className="space-y-1.5">{byPaymentMethod.rows.map((row, index) => <div key={row.name} className="flex items-center justify-between gap-2 text-sm border-b border-oro/10 pb-1.5 last:border-0"><span className="flex items-center gap-2 text-choco/80"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{row.name}</span><span className="text-right"><span className="font-semibold text-choco">{CLP(row.value)}</span><span className="text-choco/45"> · {row.count} · {byPaymentMethod.total ? Math.round((row.value / byPaymentMethod.total) * 100) : 0}%</span></span></div>)}</div></div> : <p className="text-sm text-choco/45 py-20 text-center">Sin ventas registradas.</p>}</Card><Card className="p-4"><p className="text-sm font-semibold font-brand text-choco mb-3">Stock de productos</p><ResponsiveContainer width="100%" height={260}><BarChart data={stockProducts} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip /><Bar isAnimationActive={false} dataKey="stock">{stockProducts.map((d, index) => <Cell key={index} fill={d.low ? "#dc2626" : "#C9A227"} />)}</Bar></BarChart></ResponsiveContainer></Card><Card className="p-4"><p className="text-sm font-semibold font-brand text-choco mb-1">Insumos respecto del mínimo</p><p className="text-xs text-choco/45 mb-3">100% equivale al stock mínimo.</p><ResponsiveContainer width="100%" height={300}><BarChart data={stockInsumos} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(v) => `${v}%`} /><YAxis type="category" dataKey="name" width={135} tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => `${v}%`} /><ReferenceLine x={100} stroke="#b8a692" strokeDasharray="4 4" /><Bar isAnimationActive={false} dataKey="pct">{stockInsumos.map((d, index) => <Cell key={index} fill={d.low ? "#C17817" : "#C9A227"} />)}</Bar></BarChart></ResponsiveContainer></Card></div>;
}

// ============================================================
// Clientes
// ============================================================
function buildClubWelcomeText(customer, stampsAlready) {
  const progressLine = stampsAlready > 0
    ? `Ya tienes *${stampsAlready} de ${CLUB_STAMP_TARGET}* sellos por tus compras anteriores 🎉`
    : `Cada compra suma un sello. Al completar *${CLUB_STAMP_TARGET} sellos*, tu próximo producto es *gratis* 🎁`;
  return `*¡Bienvenida al Club ${getBusinessProfile().name}!* 🍬✨\n\nHola ${customer.name}, ya eres parte de nuestro club de clientas frecuentes.\n\n${progressLine}\n\n¡Gracias por tu confianza en ${getBusinessProfile().name}!`;
}

function buildRewardText(customer) {
  return `*¡Felicidades, ${customer.name}!* 🎁\n\nCompletaste tus ${CLUB_STAMP_TARGET} sellos del Club ${getBusinessProfile().name} — en tu próxima visita eliges un producto gratis 🍬\n\n¡Te esperamos!`;
}

function buildCatalogInviteText(customer) {
  const firstName = String(customer?.name || "").trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `Hola ${firstName} 💛` : "Hola 💛";
  return `${greeting}\n\nTenemos una nueva forma de hacer tus pedidos de *${getBusinessProfile().name}*.\n\nPuedes ver nuestros productos en:\n${PUBLIC_SITE_URL}/pedir`;
}

function ClientesTab({ customers, sales, quotes, onSave }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });

  // Invitación guiada al catálogo por WhatsApp normal.
  // No envía mensajes automáticamente: prepara cada conversación para que Felipe revise y pulse Enviar.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSelected, setInviteSelected] = useState([]);
  const [inviteQueue, setInviteQueue] = useState([]);
  const [inviteQueueIndex, setInviteQueueIndex] = useState(0);
  const [inviteStarted, setInviteStarted] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  const allStats = customers.map((customer) => {
    const customerSales = sales.filter((s) => s.customerId === customer.id);
    const customerQuotes = quotes.filter((q) => q.customerId === customer.id);
    const totalSpent = customerSales.reduce((sum, s) => sum + asNumber(s.total), 0);
    const balance = customerSales.reduce((sum, s) => sum + asNumber(s.balance), 0);
    const lastSale = customerSales.length ? [...customerSales].sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO))[0] : null;

    const productTotals = new Map();
    const prepTotals = new Map();
    customerSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const qty = Math.max(0, asNumber(item.qty));
        const productName = String(item.name || "Producto").trim() || "Producto";
        productTotals.set(productName, (productTotals.get(productName) || 0) + qty);
        if (isCuchufliLine(item)) {
          const preparation = prepLabel(item);
          prepTotals.set(preparation, (prepTotals.get(preparation) || 0) + qty);
        }
      });
    });
    const favoriteProductEntry = [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const favoritePrepEntry = [...prepTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const favoriteProduct = favoriteProductEntry ? { name: favoriteProductEntry[0], qty: favoriteProductEntry[1] } : null;
    const favoritePrep = favoritePrepEntry ? { name: favoritePrepEntry[0], qty: favoritePrepEntry[1] } : null;

    const redeemed = asNumber(customer.clubRedeemed);
    const rewardsAvailable = customer.clubMember ? Math.max(0, Math.floor(customerSales.length / CLUB_STAMP_TARGET) - redeemed) : 0;
    const rawStampsProgress = customer.clubMember ? customerSales.length % CLUB_STAMP_TARGET : 0;
    const stampsProgress = customer.clubMember && rewardsAvailable > 0 ? CLUB_STAMP_TARGET : rawStampsProgress;
    return { ...customer, purchaseCount: customerSales.length, quoteCount: customerQuotes.length, totalSpent, balance, lastSale, favoriteProduct, favoritePrep, stampsProgress, rewardsAvailable };
  }).sort((a, b) => b.totalSpent - a.totalSpent);

  const stats = allStats.filter((customer) => {
    const matchesSearch = `${customer.name} ${customer.phone || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "Todos"
      || (filter === "Frecuentes" && customer.purchaseCount >= 3)
      || (filter === "Con saldo" && customer.balance > 0)
      || (filter === "Club" && customer.clubMember);
    return matchesSearch && matchesFilter;
  });
  const selectedCustomer = allStats.find((customer) => customer.id === selectedId);
  const inviteCandidates = allStats.filter((customer) => {
    if (!String(customer.phone || "").replace(/\D/g, "")) return false;
    const haystack = `${customer.name} ${customer.phone || ""}`.toLowerCase();
    return haystack.includes(inviteSearch.toLowerCase());
  });
  const sentInviteCount = allStats.filter((customer) => customer.catalogInviteSentAt).length;
  const currentInvite = inviteQueue[inviteQueueIndex] || null;

  async function submit() {
    if (!form.name.trim()) return;
    if (editingId) { if (await onSave(customers.map((c) => c.id === editingId ? { ...c, ...form, name: form.name.trim() } : c)) === false) return false; }
    else { if (await onSave([...customers, { id: uid("cli"), ...form, name: form.name.trim(), createdAt: todayISO() }]) === false) return false; }
    setShowForm(false); setEditingId(null);
  }
  async function removeCustomer(id) {
    if (sales.some(sale => sale.customerId === id) || quotes.some(quote => quote.customerId === id)) { window.alert("Este cliente tiene historial. Puedes editar su ficha, pero no eliminarla."); return false; }
    { if (await onSave(customers.filter((c) => c.id !== id)) === false) return false; }
    setConfirming(null); setSelectedId(null);
  }
  async function joinClub(customer) {
    const priorRewards = Math.floor(customer.purchaseCount / CLUB_STAMP_TARGET);
    const initialStamps = priorRewards > 0 ? CLUB_STAMP_TARGET : customer.purchaseCount % CLUB_STAMP_TARGET;
    { if (await onSave(customers.map((c) => c.id === customer.id ? { ...c, clubMember: true, clubJoinedAt: todayISO(), clubRedeemed: 0 } : c)) === false) return false; }
    await shareClubCard(customer, initialStamps, buildClubWelcomeText(customer, initialStamps));
  }
  async function redeemReward(customer) {
    { if (await onSave(customers.map((c) => c.id === customer.id ? { ...c, clubRedeemed: asNumber(c.clubRedeemed) + 1 } : c)) === false) return false; }
  }
  function openEdit(customer) {
    setSelectedId(null);
    setEditingId(customer.id);
    setForm({ name: customer.name, phone: customer.phone || "", notes: customer.notes || "" });
    setShowForm(true);
  }
  function openInviteManager() {
    setInviteSearch("");
    setInviteSelected([]);
    setInviteQueue([]);
    setInviteQueueIndex(0);
    setInviteStarted(false);
    setInviteOpen(true);
  }
  function toggleInvite(id) {
    setInviteSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function selectPendingInvites() {
    setInviteSelected(inviteCandidates.filter((customer) => !customer.catalogInviteSentAt).map((customer) => customer.id));
  }
  function startInviteQueue() {
    const selected = inviteSelected.map((id) => allStats.find((customer) => customer.id === id)).filter(Boolean);
    if (!selected.length) return;
    setInviteQueue(selected);
    setInviteQueueIndex(0);
    setInviteStarted(true);
  }
  async function markCatalogInvite(customer, sent = true) {
    const timestamp = sent ? todayISO() : null;
    { if (await onSave(customers.map((c) => c.id === customer.id ? { ...c, catalogInviteSentAt: timestamp } : c)) === false) return false; }
  }
  function handleInviteClick(customer, advanceQueue = false) {
    // El enlace abre WhatsApp; guardamos la fecha para no repetir accidentalmente la invitación.
    // Si finalmente no se envió, puede marcarse nuevamente como pendiente desde esta misma pantalla.
    void markCatalogInvite(customer, true);
    if (advanceQueue) setInviteQueueIndex((index) => index + 1);
  }
  async function shareCatalogGeneral() {
    const url = `${PUBLIC_SITE_URL}/pedir`;
    const shareData = { title: "Ojos Dulces", text: "Haz tu pedido de Ojos Dulces aquí 🍪", url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNotice("Enlace copiado");
      window.setTimeout(() => setShareNotice(""), 1800);
    } catch {
      // Cancelar el menú compartir no necesita mostrar error.
    }
  }

  return <div className="space-y-4">
    <div className="flex items-end justify-between gap-3">
      <div><p className="font-brand text-2xl font-semibold text-choco">Tus clientes</p><p className="text-xs text-choco/42 mt-1">Busca a alguien y entra a su ficha solo cuando necesites más detalle.</p></div>
      <div className="flex gap-2 shrink-0">
        {import.meta.env.VITE_ENABLE_LEGACY_SHOP === 'true' && <button onClick={openInviteManager} className="min-h-11 px-3 sm:px-4 rounded-xl border border-oro/20 bg-white text-choco text-sm font-semibold flex items-center justify-center gap-1.5"><MessageCircle size={16} /><span className="hidden sm:inline">Invitar</span></button>}
        <button onClick={() => { setEditingId(null); setForm({ name: "", phone: "", notes: "" }); setShowForm(true); }} className="w-11 h-11 sm:w-auto sm:px-4 rounded-xl bg-choco text-crema text-sm font-semibold flex items-center justify-center gap-1.5"><Plus size={16} /><span className="hidden sm:inline">Nuevo</span></button>
      </div>
    </div>

    <div className="relative"><Search size={15} className="absolute left-3.5 top-3.5 text-choco/35" /><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono" className="w-full pl-10 bg-white" /></div>

    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {["Todos", "Frecuentes", "Con saldo", "Club"].map((value) => <button key={value} onClick={() => setFilter(value)} className={"min-h-9 px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap " + (filter === value ? "bg-choco text-crema border-choco" : "bg-white text-choco/55 border-oro/15")}>{value}</button>)}
    </div>

    {showForm && <Modal title={editingId ? "Editar cliente" : "Nuevo cliente"} onClose={() => { setShowForm(false); setEditingId(null); }}>
      <div className="space-y-4">
        <div><p className="text-sm text-choco/60">Guarda solo lo que te sea útil. El nombre es el único dato necesario.</p></div>
        <Field label="Nombre"><TextInput autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Camila" className="w-full" /></Field>
        <Field label="WhatsApp / teléfono · opcional"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+56 9 ..." className="w-full" /></Field>
        <Field label="Nota · opcional"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Preferencias, dirección habitual, etc." className="w-full" /></Field>
        <button onClick={submit} disabled={!form.name.trim()} className="w-full min-h-12 bg-choco text-crema rounded-xl font-semibold disabled:opacity-35">Guardar cliente</button>
      </div>
    </Modal>}

    {inviteOpen && <Modal title="Invitar al catálogo" onClose={() => setInviteOpen(false)} wide>
      {!inviteStarted ? <div className="space-y-4">
        <div className="rounded-2xl bg-crema/60 border border-oro/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="font-semibold text-choco">Envía el nuevo catálogo sin copiar y pegar</p><p className="text-xs text-choco/50 mt-1 leading-relaxed">Selecciona a quién quieres contactar. La app abrirá WhatsApp con el mensaje personalizado listo; tú sólo revisas y pulsas Enviar.</p></div>
            <MessageCircle size={20} className="text-caramelo shrink-0 mt-0.5" />
          </div>
          <button onClick={shareCatalogGeneral} className="mt-3 min-h-10 px-3 rounded-xl bg-white border border-oro/20 text-xs font-semibold text-choco">{shareNotice || "Compartir catálogo por otra app"}</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white border border-oro/15 p-3"><p className="text-[10px] uppercase tracking-wide text-choco/35 font-bold">Con WhatsApp</p><p className="text-xl font-bold text-choco mt-1">{allStats.filter((customer) => String(customer.phone || "").replace(/\D/g, "")).length}</p></div>
          <div className="rounded-2xl bg-white border border-oro/15 p-3"><p className="text-[10px] uppercase tracking-wide text-choco/35 font-bold">Ya invitados</p><p className="text-xl font-bold text-caramelo mt-1">{sentInviteCount}</p></div>
        </div>

        <div className="relative"><Search size={15} className="absolute left-3.5 top-3.5 text-choco/35" /><TextInput value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full pl-10" /></div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-choco/45">{inviteSelected.length} seleccionado{inviteSelected.length === 1 ? "" : "s"}</p>
          <div className="flex gap-2"><button onClick={selectPendingInvites} className="text-xs font-semibold text-caramelo">Seleccionar pendientes</button>{inviteSelected.length > 0 && <button onClick={() => setInviteSelected([])} className="text-xs font-semibold text-choco/40">Limpiar</button>}</div>
        </div>

        <div className="max-h-[44vh] overflow-y-auto rounded-2xl border border-oro/15 bg-white divide-y divide-oro/10">
          {inviteCandidates.length === 0 ? <p className="p-6 text-sm text-center text-choco/40">No hay clientes con teléfono en esta búsqueda.</p> : inviteCandidates.map((customer) => {
            const checked = inviteSelected.includes(customer.id);
            return <button key={customer.id} onClick={() => toggleInvite(customer.id)} className="w-full p-3 flex items-center gap-3 text-left hover:bg-crema/40">
              <span className={"w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 " + (checked ? "bg-choco border-choco text-crema" : "bg-white border-oro/25 text-transparent")}><Check size={14} /></span>
              <span className="w-10 h-10 rounded-full bg-crema flex items-center justify-center font-brand text-lg font-semibold text-choco shrink-0">{String(customer.name || "?").trim().charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-choco truncate">{customer.name}</p><p className="text-xs text-choco/40 truncate">{customer.phone}</p></div>
              {customer.catalogInviteSentAt ? <div className="text-right shrink-0"><Badge color="emerald">Enviado</Badge><p className="text-[10px] text-choco/35 mt-1">{fmtDate(customer.catalogInviteSentAt, false)}</p></div> : <Badge color="stone">Pendiente</Badge>}
            </button>;
          })}
        </div>

        <button onClick={startInviteQueue} disabled={!inviteSelected.length} className="w-full min-h-12 rounded-xl bg-choco text-crema font-semibold disabled:opacity-35 flex items-center justify-center gap-2"><MessageCircle size={17} /> Comenzar envíos{inviteSelected.length ? ` (${inviteSelected.length})` : ""}</button>
      </div> : <div className="space-y-4">
        {currentInvite ? <>
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-choco/40">Mensaje {inviteQueueIndex + 1} de {inviteQueue.length}</p><button onClick={() => { setInviteStarted(false); setInviteQueue([]); setInviteQueueIndex(0); }} className="text-xs font-semibold text-choco/45">Volver a selección</button></div>
          <div className="rounded-[22px] border border-oro/15 bg-crema/55 p-4">
            <div className="flex items-center gap-3"><span className="w-12 h-12 rounded-full bg-white flex items-center justify-center font-brand text-xl font-semibold text-choco">{String(currentInvite.name || "?").trim().charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="font-semibold text-choco truncate">{currentInvite.name}</p><p className="text-xs text-choco/45">{currentInvite.phone}</p></div></div>
            <div className="mt-4 rounded-2xl bg-white border border-oro/10 p-3 text-sm text-choco/70 whitespace-pre-line leading-relaxed">{buildCatalogInviteText(currentInvite)}</div>
          </div>
          <a href={whatsappUrl(currentInvite.phone, buildCatalogInviteText(currentInvite))} target="_blank" rel="noreferrer" onClick={() => handleInviteClick(currentInvite, true)} className="w-full min-h-12 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2"><MessageCircle size={18} /> Abrir WhatsApp</a>
          <p className="text-[11px] text-center text-choco/40">Al abrir WhatsApp lo marcamos como enviado para ayudarte a no repetir contactos. Si finalmente no lo envías, puedes devolverlo a pendiente más abajo.</p>
          <button onClick={() => setInviteQueueIndex((index) => index + 1)} className="w-full min-h-11 rounded-xl border border-oro/20 bg-white text-sm font-semibold text-choco">Saltar este cliente</button>
        </> : <div className="text-center py-6">
          <span className="w-16 h-16 rounded-full bg-oro/15 text-caramelo mx-auto flex items-center justify-center"><Check size={28} /></span>
          <p className="font-brand text-2xl font-semibold text-choco mt-4">Lista terminada</p><p className="text-sm text-choco/50 mt-1">Revisaste los {inviteQueue.length} clientes seleccionados.</p>
          <button onClick={() => { setInviteOpen(false); setInviteStarted(false); setInviteQueue([]); setInviteQueueIndex(0); setInviteSelected([]); }} className="mt-5 min-h-11 px-5 rounded-xl bg-choco text-crema text-sm font-semibold">Listo</button>
        </div>}
      </div>}

      {!inviteStarted && sentInviteCount > 0 && <div className="mt-4 pt-4 border-t border-oro/10">
        <p className="text-xs font-semibold text-choco/45 mb-2">Administrar enviados</p>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">{allStats.filter((customer) => customer.catalogInviteSentAt).map((customer) => <div key={customer.id} className="flex items-center justify-between gap-2 rounded-xl bg-crema/45 px-3 py-2"><div className="min-w-0"><p className="text-xs font-semibold text-choco truncate">{customer.name}</p><p className="text-[10px] text-choco/35">{fmtDate(customer.catalogInviteSentAt, false)}</p></div><button onClick={() => markCatalogInvite(customer, false)} className="text-[11px] font-semibold text-caramelo shrink-0">Marcar pendiente</button></div>)}</div>
      </div>}
    </Modal>}

    {selectedCustomer && <Modal title={selectedCustomer.name} onClose={() => { setSelectedId(null); setConfirming(null); }}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-rosa/16 text-choco flex items-center justify-center font-brand text-2xl font-semibold shrink-0">{String(selectedCustomer.name || "?").trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1"><p className="font-brand text-2xl font-semibold text-choco truncate">{selectedCustomer.name}</p>{selectedCustomer.phone ? <a href={whatsappUrl(selectedCustomer.phone, `Hola ${selectedCustomer.name} 👋`)} target="_blank" rel="noreferrer" className="text-sm text-caramelo inline-flex items-center gap-1 mt-0.5"><MessageCircle size={13} /> {selectedCustomer.phone}</a> : <p className="text-xs text-choco/35 mt-1">Sin teléfono guardado</p>}</div>
        </div>

        {selectedCustomer.phone && <a href={whatsappUrl(selectedCustomer.phone, buildCatalogInviteText(selectedCustomer))} target="_blank" rel="noreferrer" onClick={() => handleInviteClick(selectedCustomer, false)} className="w-full min-h-11 rounded-xl border border-oro/20 bg-white text-choco text-sm font-semibold flex items-center justify-center gap-2"><MessageCircle size={16} /> {selectedCustomer.catalogInviteSentAt ? "Reenviar catálogo" : "Enviar catálogo"}</a>}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-crema/70 p-3"><p className="text-[10px] uppercase tracking-wide text-choco/35 font-bold">Compras</p><p className="text-lg font-bold text-choco mt-1">{selectedCustomer.purchaseCount}</p></div>
          <div className="rounded-2xl bg-crema/70 p-3"><p className="text-[10px] uppercase tracking-wide text-choco/35 font-bold">Total</p><p className="text-base font-bold text-choco mt-1">{CLP(selectedCustomer.totalSpent)}</p></div>
          <div className="rounded-2xl bg-crema/70 p-3"><p className="text-[10px] uppercase tracking-wide text-choco/35 font-bold">Saldo</p><p className={"text-base font-bold mt-1 " + (selectedCustomer.balance > 0 ? "text-caramelo" : "text-choco")}>{CLP(selectedCustomer.balance)}</p></div>
        </div>

        {selectedCustomer.lastSale && <div className="rounded-2xl border border-oro/15 p-3"><p className="text-[10px] uppercase tracking-wide text-choco/35 font-bold">Última compra</p><p className="text-sm font-semibold text-choco mt-1">{fmtDate(selectedCustomer.lastSale.dateISO, false)} · {CLP(selectedCustomer.lastSale.total)}</p><p className="text-xs text-choco/45 mt-1 line-clamp-2">{selectedCustomer.lastSale.items.map((item) => `${item.qty}x ${item.name}`).join(" · ")}</p></div>}

        {(selectedCustomer.favoriteProduct || selectedCustomer.favoritePrep) && <div className="rounded-2xl border border-oro/15 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wide text-choco/35 font-bold">Preferencias detectadas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {selectedCustomer.favoriteProduct && <div className="rounded-xl bg-crema/55 px-3 py-2.5"><p className="text-[10px] text-choco/40 font-semibold">Producto más pedido</p><p className="text-sm font-semibold text-choco mt-0.5">{selectedCustomer.favoriteProduct.name}</p><p className="text-[10px] text-choco/40 mt-0.5">{NUM(selectedCustomer.favoriteProduct.qty)} unidades acumuladas</p></div>}
            {selectedCustomer.favoritePrep && <div className="rounded-xl bg-crema/55 px-3 py-2.5"><p className="text-[10px] text-choco/40 font-semibold">Preferencia cuchuflí</p><p className="text-sm font-semibold text-choco mt-0.5">{selectedCustomer.favoritePrep.name}</p><p className="text-[10px] text-choco/40 mt-0.5">{NUM(selectedCustomer.favoritePrep.qty)} unidades acumuladas</p></div>}
          </div>
        </div>}

        {selectedCustomer.notes && <div><p className="text-xs font-semibold text-choco/45 mb-1">Nota</p><p className="text-sm text-choco/65 bg-crema/55 rounded-xl px-3 py-2.5">{selectedCustomer.notes}</p></div>}

        <div className="rounded-2xl bg-oro/8 border border-oro/15 p-3">
          {selectedCustomer.clubMember ? <>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-choco">Club {getBusinessProfile().name}</p><p className="text-xs text-choco/42 mt-0.5">{selectedCustomer.stampsProgress}/{CLUB_CARD_SLOTS} compras hacia el próximo premio</p></div><button onClick={() => shareClubCard(selectedCustomer, selectedCustomer.stampsProgress, buildClubWelcomeText(selectedCustomer, selectedCustomer.stampsProgress))} className="text-xs font-semibold text-caramelo">Ver tarjeta</button></div>
            <div className="flex gap-1.5 mt-3">{Array.from({ length: CLUB_CARD_SLOTS }).map((_, i) => <span key={i} className={"h-2 flex-1 rounded-full " + (i < selectedCustomer.stampsProgress ? "bg-caramelo" : "bg-choco/10")} />)}</div>
            {selectedCustomer.rewardsAvailable > 0 && <div className="mt-3 flex items-center justify-between gap-2"><Badge color="amber">🎁 Premio disponible</Badge><button onClick={() => redeemReward(selectedCustomer)} className="text-xs font-semibold text-caramelo">Marcar canjeado</button></div>}
          </> : <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-choco">Club {getBusinessProfile().name}</p><p className="text-xs text-choco/42 mt-0.5">Opcional. Actívalo si quieres fidelizar a este cliente.</p></div><button onClick={() => joinClub(selectedCustomer)} className="min-h-9 px-3 rounded-xl bg-white border border-oro/20 text-xs font-semibold text-choco">Inscribir</button></div>}
        </div>

        <div className="flex gap-2 pt-2 border-t border-oro/10">
          <button onClick={() => openEdit(selectedCustomer)} className="flex-1 min-h-11 rounded-xl bg-choco text-crema text-sm font-semibold"><Pencil size={14} className="inline mr-1.5" /> Editar</button>
          {confirming === selectedCustomer.id ? <><button onClick={() => removeCustomer(selectedCustomer.id)} className="px-3 min-h-11 rounded-xl bg-red-600 text-white text-xs font-semibold">Eliminar</button><button onClick={() => setConfirming(null)} className="w-11 min-h-11 rounded-xl border border-oro/20 text-choco/50"><X size={15} className="mx-auto" /></button></> : <button onClick={() => setConfirming(selectedCustomer.id)} className="w-11 min-h-11 rounded-xl border border-oro/20 text-red-400"><Trash2 size={15} className="mx-auto" /></button>}
        </div>
      </div>
    </Modal>}

    {stats.length === 0 ? <EmptyState>{search ? "No encontré clientes con esa búsqueda." : "Todavía no hay clientes en esta vista."}</EmptyState> : <Card className="overflow-hidden shadow-none">
      <div className="divide-y divide-oro/10">
        {stats.map((customer) => <button key={customer.id} onClick={() => setSelectedId(customer.id)} className="w-full p-3.5 sm:p-4 flex items-center gap-3 text-left hover:bg-crema/40 transition-colors">
          <span className="w-11 h-11 rounded-full bg-crema text-choco flex items-center justify-center font-brand text-lg font-semibold shrink-0">{String(customer.name || "?").trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0"><p className="font-semibold text-sm text-choco truncate">{customer.name}</p>{customer.purchaseCount >= 3 && <Star size={12} className="text-caramelo shrink-0" />}{customer.clubMember && <span className="w-1.5 h-1.5 rounded-full bg-oro shrink-0" />}</div>
            <p className="text-xs text-choco/40 truncate mt-0.5">{customer.purchaseCount ? `${customer.purchaseCount} compra${customer.purchaseCount === 1 ? "" : "s"}${customer.lastSale ? ` · última ${fmtDate(customer.lastSale.dateISO, false)}` : ""}` : "Sin compras todavía"}</p>
          </div>
          <div className="text-right shrink-0"><p className="text-sm font-semibold text-choco">{customer.totalSpent > 0 ? CLP(customer.totalSpent) : "—"}</p>{customer.balance > 0 && <p className="text-[10px] font-semibold text-caramelo mt-0.5">Debe {CLP(customer.balance)}</p>}</div>
          <ArrowRight size={15} className="text-choco/25 shrink-0" />
        </button>)}
      </div>
    </Card>}
  </div>;
}

// ============================================================
// Configuración de interfaz y preferencias del dispositivo
// ============================================================
function SettingSwitch({ checked, onChange, label, description, icon: Icon }) {
  return <div className="flex items-center justify-between gap-4 py-3.5 border-b border-oro/10 last:border-0">
    <div className="flex items-start gap-3 min-w-0">
      {Icon && <span className="w-9 h-9 rounded-xl bg-crema flex items-center justify-center text-choco shrink-0"><Icon size={17} /></span>}
      <div><p className="text-sm font-semibold text-choco">{label}</p>{description && <p className="text-xs text-choco/45 mt-0.5 leading-relaxed">{description}</p>}</div>
    </div>
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={"relative w-12 h-7 rounded-full transition-colors shrink-0 overflow-hidden " + (checked ? "bg-choco" : "bg-choco/15")}>
      <span className={"absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out " + (checked ? "translate-x-5" : "translate-x-0")} />
    </button>
  </div>;
}

function ChoiceCards({ value, onChange, options, columns = "grid-cols-2 sm:grid-cols-3" }) {
  return <div className={`grid ${columns} gap-2`}>{options.map((option) => {
    const Icon = option.icon;
    const active = value === option.value;
    return <button key={option.value} type="button" onClick={() => onChange(option.value)} className={"min-h-[82px] rounded-2xl border p-3 text-left transition-all " + (active ? "border-caramelo bg-oro/15 ring-1 ring-caramelo/20" : "border-oro/15 bg-white hover:border-oro/35")}>
      <div className="flex items-center justify-between gap-2">{Icon && <Icon size={18} className={active ? "text-caramelo" : "text-choco/55"} />}{active && <Check size={15} className="text-caramelo" />}</div>
      <p className="text-sm font-semibold text-choco mt-2">{option.label}</p>{option.description && <p className="text-[11px] text-choco/45 mt-0.5">{option.description}</p>}
    </button>;
  })}</div>;
}

function ConfiguracionTab({ settings, onChange, onReset, onPersonalize, exportBackup, importBackup, setTab, webAdminSecret, onWebSecretChange, onRefreshWebOrders, onPublishCatalog, notificationPermission, pushStatus, pushBusy, pushError, onEnableOrderNotifications, onDisableOrderNotifications }) {
  const [section, setSection] = usePersistentView("configuracionSub", "apariencia");
  const [secretDraft, setSecretDraft] = useState(webAdminSecret || "");
  const [copyState, setCopyState] = useState("");
  const publicUrl = `${PUBLIC_SITE_URL}/pedir`;
  const sections = [
    ["apariencia", "Apariencia", Palette],
    ["inicio", "Inicio y uso", SlidersHorizontal],
    ...(import.meta.env.VITE_ENABLE_LEGACY_SHOP === 'true' ? [["pedidosweb", "Pedidos web", ShoppingCart]] : []),
    ["privacidad", "Privacidad", Shield],
    ["datos", "Datos y respaldo", Database],
  ];
  const pushStatusText = pushStatus === "active" ? "Push activo · avisa aunque la app esté cerrada"
    : pushStatus === "needs-install" ? "En iPhone debes instalar Ojos Dulces en la pantalla de inicio"
    : pushStatus === "denied" ? "Permiso de notificaciones bloqueado en este dispositivo"
    : pushStatus === "unsupported" ? "Web Push no está disponible en este dispositivo"
    : pushStatus === "checking" ? "Comprobando este dispositivo…"
    : pushStatus === "error" ? "Hay un problema con la configuración push"
    : notificationPermission === "granted" ? "Permiso concedido · falta registrar este dispositivo"
    : "Aún no activadas";

  return <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
    <Card className="p-2 h-fit lg:sticky lg:top-[96px]">
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">{sections.map(([id, label, Icon]) => <button key={id} onClick={() => setSection(id)} className={"min-h-11 rounded-xl px-3 flex items-center gap-2.5 text-sm font-semibold text-left transition-colors " + (section === id ? "bg-choco text-crema" : "text-choco/65 hover:bg-crema")}><Icon size={16} /><span>{label}</span></button>)}</div>
    </Card>

    <div className="min-w-0">
      {section === "apariencia" && <section className="command-card settings-studio-card"><div className="command-icon mint"><Palette size={24}/></div><span className="ce-eyebrow">TU ESPACIO TIENE TU FIRMA</span><h3>Hazlo tuyo.</h3><p>Elige tus colores, sube tu logo y decide qué quieres ver primero. Crea un espacio que te acompañe a trabajar mejor.</p><div className="settings-palette-dots">{['#10b981','#4675ef','#8b5cf6','#db754c','#d85d92','#14a8ad'].map(c=><i style={{background:c}} key={c}/>)}</div><button className="ce-button" onClick={onPersonalize}><Palette size={17}/>Personalizar mi espacio<ArrowRight size={17}/></button><small>Preferencias personales en este navegador y negocio.</small></section>}

      {section === "inicio" && <div className="space-y-4">
        <Card className="p-4 sm:p-5"><p className="font-brand text-xl font-semibold text-choco">Continuidad de trabajo</p><p className="text-xs text-choco/45 mt-1 mb-4">Puedes volver exactamente a la sección donde estabas, incluso si el navegador recarga la aplicación.</p>
          <SettingSwitch checked={settings.rememberLastView} onChange={(value) => onChange({ rememberLastView:value })} label="Recordar última vista" description="Guarda la última sección y las pestañas internas de este dispositivo." icon={History} />
          <div className="mt-4"><Field label="Página inicial si no hay una vista recordada"><SelectInput value={settings.initialPage} onChange={(e) => onChange({ initialPage:e.target.value })} className="w-full">{NAV_ITEMS.filter((item) => item.id !== "configuracion").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectInput></Field></div>
        </Card>
        <Card className="p-4 sm:p-5"><p className="font-brand text-xl font-semibold text-choco mb-1">Contenido del Inicio</p><p className="text-xs text-choco/45 mb-2">Decide cuánta información quieres ver en el resumen.</p>
          <button className="ce-button ce-button-secondary" onClick={onPersonalize}><SlidersHorizontal size={17}/>Elegir y ordenar mis tarjetas</button>
        </Card>
        <Card className="p-4 sm:p-5"><p className="font-brand text-xl font-semibold text-choco mb-4">Nueva venta</p>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Método de pago predeterminado"><SelectInput value={settings.defaultPaymentMethod} onChange={(e) => onChange({ defaultPaymentMethod:e.target.value })} className="w-full">{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</SelectInput></Field><Field label="Estado inicial del pedido"><SelectInput value={settings.defaultOrderStatus} onChange={(e) => onChange({ defaultOrderStatus:e.target.value })} className="w-full">{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</SelectInput></Field></div>
          <SettingSwitch checked={settings.showCostsInSale} onChange={(value) => onChange({ showCostsInSale:value })} label="Mostrar costos y margen al vender" description="Si se desactiva, la pantalla de venta se ve más limpia y no expone costos internos." icon={CircleDollarSign} />
        </Card>
      </div>}

      {section === "pedidosweb" && <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="font-brand text-xl font-semibold text-choco">Catálogo para clientes</p><p className="text-xs text-choco/45 mt-1">Este es el único enlace que debes compartir para recibir pedidos.</p></div><span className="w-11 h-11 rounded-2xl bg-crema text-caramelo flex items-center justify-center"><ShoppingCart size={19} /></span></div>
          <div className="mt-4 rounded-2xl bg-crema/60 border border-oro/10 px-3 py-3 text-xs text-choco/65 break-all">{publicUrl}</div>
          <div className="grid sm:grid-cols-2 gap-2 mt-3"><button onClick={async () => { try { await navigator.clipboard.writeText(publicUrl); setCopyState("Copiado"); window.setTimeout(() => setCopyState(""), 1600); } catch { window.prompt("Copia este enlace:", publicUrl); } }} className="min-h-11 rounded-xl border border-oro/20 bg-white text-sm font-semibold text-choco">{copyState || "Copiar enlace"}</button><button onClick={onPublishCatalog} className="min-h-11 rounded-xl bg-choco text-crema text-sm font-semibold flex items-center justify-center gap-2"><Upload size={15} /> Publicar catálogo</button></div>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="font-brand text-xl font-semibold text-choco">Conexión privada</p><p className="text-xs text-choco/45 mt-1 mb-3">La clave sólo se usa para leer y administrar los pedidos web desde este dispositivo.</p>
          <Field label="Clave privada de Pedidos web"><TextInput type="password" value={secretDraft} onChange={(e) => setSecretDraft(e.target.value)} placeholder="Clave privada" className="w-full" /></Field>
          <button onClick={async () => { const value = secretDraft.trim(); onWebSecretChange(value); await onRefreshWebOrders(value); }} disabled={!secretDraft.trim()} className="mt-3 min-h-11 px-4 rounded-xl bg-choco text-crema text-sm font-semibold disabled:opacity-40">Guardar y conectar</button>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-2xl bg-oro/15 text-choco flex items-center justify-center shrink-0"><Bell size={19} /></span><div className="min-w-0 flex-1"><p className="font-brand text-xl font-semibold text-choco">Notificaciones tipo Shopify</p><p className="text-xs text-choco/45 mt-1">Un pedido nuevo puede despertar el teléfono, aparecer en la pantalla bloqueada y abrir directamente ese pedido al tocar la notificación.</p></div></div>
          <div className="mt-4 rounded-2xl bg-crema/55 p-3">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-choco">Este dispositivo</p><p className="text-xs text-choco/45 mt-0.5">{pushStatusText}</p></div>{pushStatus === "active" ? <Badge color="emerald">Activo</Badge> : pushStatus === "error" || pushStatus === "denied" ? <Badge color="red">Revisar</Badge> : <Badge color="amber">Pendiente</Badge>}</div>
            {pushStatus === "needs-install" && <div className="mt-3 rounded-xl bg-white border border-oro/15 p-3 text-xs leading-5 text-choco/60"><strong className="text-choco">En iPhone:</strong> abre este sitio en Safari → Compartir → <strong>Añadir a pantalla de inicio</strong>. Luego abre Ojos Dulces desde el ícono nuevo y vuelve a este botón.</div>}
            {pushStatus === "denied" && <div className="mt-3 rounded-xl bg-white border border-red-100 p-3 text-xs leading-5 text-choco/60">Debes volver a permitir notificaciones desde Ajustes del iPhone para Ojos Dulces y luego regresar a la app.</div>}
            {pushError && <p className="mt-3 text-xs text-red-600 break-words">{pushError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {pushStatus === "active" ? <button onClick={onDisableOrderNotifications} disabled={pushBusy} className="min-h-11 rounded-xl border border-oro/20 bg-white text-sm font-semibold text-choco disabled:opacity-45">{pushBusy ? "Procesando…" : "Desactivar en este dispositivo"}</button> : <button onClick={onEnableOrderNotifications} disabled={pushBusy || pushStatus === "unsupported" || pushStatus === "denied" || pushStatus === "needs-install"} className="min-h-11 rounded-xl bg-choco text-crema text-sm font-semibold disabled:opacity-45 flex items-center justify-center gap-2">{pushBusy ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />} {pushBusy ? "Activando…" : "Activar notificaciones push"}</button>}
            </div>
          </div>
          <p className="text-[11px] text-choco/40 mt-3">La activación se hace por dispositivo. Puedes habilitarla también en otro iPhone, iPad o computador y ambos recibirán el aviso del mismo pedido.</p>
        </Card>
      </div>}

      {section === "privacidad" && <div className="space-y-4">
        <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-brand text-xl font-semibold text-choco">Montos en pantalla</p><p className="text-xs text-choco/45 mt-1 max-w-xl">Oculta precios, ventas, utilidad, saldos y demás montos mostrados. No cambia los datos reales, boletas, respaldos ni exportaciones.</p></div><span className="w-11 h-11 rounded-2xl bg-crema flex items-center justify-center text-choco">{settings.hideAmounts ? <EyeOff size={20} /> : <Eye size={20} />}</span></div>
          <SettingSwitch checked={settings.hideAmounts} onChange={(value) => onChange({ hideAmounts:value })} label={settings.hideAmounts ? "Montos ocultos" : "Montos visibles"} description="También puedes cambiarlo rápidamente con el botón del ojo en la parte superior." icon={settings.hideAmounts ? EyeOff : Eye} />
          <div className="mt-4 rounded-2xl bg-crema p-4"><p className="text-[10px] uppercase tracking-wider text-choco/40 font-bold">Vista previa</p><p className="font-brand text-2xl font-semibold text-choco mt-1">{settings.hideAmounts ? "$ •••••" : RAW_CLP(24890)}</p><p className="text-xs text-choco/45 mt-1">El valor real permanece guardado aunque esté oculto.</p></div>
        </Card>
      </div>}

      {section === "datos" && <div className="space-y-4">
        <Card className="p-4 sm:p-5"><p className="font-brand text-xl font-semibold text-choco">Respaldo del negocio</p><p className="text-xs text-choco/45 mt-1 mb-4">Estas acciones incluyen ventas, clientes, cotizaciones, gastos y demás datos guardados. Las preferencias visuales de este dispositivo no forman parte del respaldo.</p>
          <div className="grid sm:grid-cols-2 gap-2"><button onClick={()=>exportBackup()} className="min-h-12 rounded-xl bg-choco text-crema px-4 flex items-center justify-center gap-2 text-sm font-semibold"><Download size={16} /> Descargar respaldo</button><label className="min-h-12 rounded-xl bg-white border border-oro/20 text-choco px-4 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer hover:bg-crema"><Upload size={16} /> Importar respaldo<input disabled={window.businessContext?.role==='reader'} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importBackup(e.target.files?.[0])} /></label></div>
        </Card>
        <Card className="p-4 sm:p-5"><p className="font-brand text-xl font-semibold text-choco">Restablecer apariencia</p><p className="text-xs text-choco/45 mt-1 mb-4">Vuelve a las preferencias visuales originales. No elimina ningún dato del negocio.</p><button onClick={onReset} className="min-h-11 px-4 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 flex items-center gap-2 text-sm font-semibold"><RotateCcw size={16} /> Restablecer configuración</button></Card>
        <button onClick={() => setTab("resumen")} className="text-sm font-semibold text-caramelo hover:underline">← Volver al Inicio</button>
      </div>}
    </div>
  </div>;
}

// ============================================================
// Registros y exportación
// ============================================================
function HistorialTab({ sales, expenses, productions, onDeleteSale, onUpdateSale }) {
  const [sub, setSub] = usePersistentView("historialSub", "ventas");
  const safeSub = ["ventas", "gastos"].includes(sub) ? sub : "ventas";
  useEffect(() => { if (sub !== safeSub) setSub(safeSub); }, [sub, safeSub, setSub]);
  return <div><div className="flex gap-2 mb-4">{[["ventas", `Ventas (${sales.length})`], ["gastos", `Gastos (${expenses.length})`]].map(([value, label]) => <button key={value} onClick={() => setSub(value)} className={"px-3.5 py-1.5 rounded-lg text-sm font-medium " + (safeSub === value ? "bg-choco text-crema" : "bg-white border border-oro/25 text-choco/70")}>{label}</button>)}</div>{safeSub === "ventas" && <SalesHistory sales={sales} onDelete={onDeleteSale} onUpdate={onUpdateSale} />}{safeSub === "gastos" && <SimpleExpenseHistory expenses={expenses} />}</div>;
}

function SalesHistory({ sales, onDelete, onUpdate }) {
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const filtered = sales.filter((s) => `${s.customerName} ${s.items.map((i) => i.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  function exportSales() {
    downloadCSV(`ventas_${todayDate()}.csv`, [["Fecha", "Cliente", "Productos", "Subtotal", "Descuento", "Despacho", "Total", "Pagado", "Saldo", "Método", "Pedido", "Fecha entrega", "Hora entrega", "Costo", "Utilidad"], ...filtered.map((s) => [fmtDate(s.dateISO), s.customerName, s.items.map((i) => `${i.qty}x ${i.name}`).join("; "), s.subtotal, s.discount, s.delivery, s.total, s.paidAmount, s.balance, s.paymentMethod, s.orderStatus, s.deliveryDate || "", s.deliveryTime || "", s.cost, s.total - s.cost])]);
  }
  function openEdit(sale) {
    setEditing(sale.id);
    setForm({ customerName: sale.customerName, paymentMethod: sale.paymentMethod, discount: sale.discount || 0, delivery: sale.delivery || 0, orderStatus: sale.orderStatus, deliveryDate: sale.deliveryDate || "", deliveryTime: sale.deliveryTime || "", notes: sale.notes || "", paymentDueDate: sale.paymentDueDate || "", paidAmount: sale.paidAmount || 0 });
  }
  async function saveEdit(sale) {
    const total = Math.max(0, asNumber(sale.subtotal) - asNumber(form.discount) + asNumber(form.delivery));
    { if (await onUpdate(sale.id, { customerName: form.customerName.trim() || sale.customerName, paymentMethod: form.paymentMethod, discount: asNumber(form.discount), delivery: asNumber(form.delivery), total, orderStatus: form.orderStatus, deliveryDate: form.deliveryDate || "", deliveryTime: form.deliveryTime || "", notes: form.notes, paymentDueDate: form.paymentDueDate || "", paidAmount: asNumber(form.paidAmount) }) === false) return false; }
    setEditing(null);
  }
  return <div><div className="flex flex-col sm:flex-row gap-3 mb-4"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-choco/45" /><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar venta..." className="w-full pl-9" /></div><button onClick={exportSales} className="px-4 py-2.5 rounded-xl border border-oro/25 bg-white text-sm flex items-center justify-center gap-1 text-choco hover:bg-crema transition-colors"><Download size={15} /> Exportar CSV</button></div>
    {editing && form && (() => { const sale = sales.find((s) => s.id === editing); if (!sale) return null; return <Modal title="Editar venta" onClose={() => setEditing(null)}>
      <div className="space-y-3">
        <p className="text-xs text-choco/50 bg-crema rounded-lg px-3 py-2">{sale.items.map((i) => `${i.qty}x ${i.name}`).join(" · ")} — los productos de la venta no se pueden editar aquí; si están mal, elimina la venta y regístrala de nuevo.</p>
        <Field label="Cliente"><TextInput value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="w-full" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Método de pago"><SelectInput value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</SelectInput></Field>
          <Field label="Estado del pedido"><SelectInput value={form.orderStatus} onChange={(e) => setForm({ ...form, orderStatus: e.target.value })} className="w-full">{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</SelectInput></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha de entrega"><TextInput type="date" value={form.deliveryDate || ""} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className="w-full" /></Field>
          <Field label="Hora de entrega"><TextInput type="time" value={form.deliveryTime || ""} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} className="w-full" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Descuento"><TextInput type="number" min="0" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="w-full" /></Field>
          <Field label="Despacho"><TextInput type="number" min="0" value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })} className="w-full" /></Field>
        </div>
        <Field label="Vencimiento del pago"><TextInput type="date" value={form.paymentDueDate || ""} onChange={e=>setForm({...form,paymentDueDate:e.target.value})} className="w-full"/></Field>
        <Field label="Monto pagado"><TextInput type="number" min="0" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} className="w-full" /></Field>
        <p className="text-xs text-choco/45">Nuevo total: {CLP(Math.max(0, asNumber(sale.subtotal) - asNumber(form.discount) + asNumber(form.delivery)))}</p>
        <Field label="Notas"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full" /></Field>
        <button onClick={() => saveEdit(sale)} className="w-full py-2.5 bg-choco text-crema hover:bg-choco-dark transition-colors active:scale-[0.98] rounded-lg">Guardar cambios</button>
      </div>
    </Modal>; })()}
    {filtered.length === 0 ? <EmptyState>No hay ventas registradas.</EmptyState> : <div className="space-y-2">{filtered.map((sale) => <Card key={sale.id} className="p-4 hover:shadow-md hover:border-oro/40 transition-all"><div className="flex justify-between gap-3"><div><div className="flex gap-2 items-center flex-wrap"><p className="font-semibold">{sale.customerName}</p><Badge color={statusColor(sale.paymentStatus)}>{sale.paymentStatus}</Badge><Badge color={statusColor(sale.orderStatus)}>{sale.orderStatus}</Badge></div><p className="text-xs text-choco/45 mt-1">{fmtDate(sale.dateISO)} · {sale.paymentMethod}</p>{sale.deliveryDate && <p className="text-xs font-medium text-caramelo mt-1 flex items-center gap-1"><CalendarDays size={11} /> {deliveryLabel(sale)}</p>}<p className="text-xs text-choco/60 mt-2">{sale.items.map((i) => `${i.qty}x ${i.name}`).join(" · ")}</p><p className="text-xs text-choco/45 mt-1">Costo {CLP(sale.cost)} · margen bruto {CLP(sale.total - sale.cost)}</p></div><div className="text-right"><p className="font-bold text-choco">{CLP(sale.total)}</p>{sale.balance > 0 && <p className="text-xs text-caramelo">Saldo {CLP(sale.balance)}</p>}<div className="flex gap-1 mt-2 justify-end">{confirming === sale.id ? <><button onClick={async () => { { if (await onDelete(sale.id) === false) return false; } setConfirming(null); }} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Confirmar</button><button onClick={() => setConfirming(null)} className="p-1 text-choco/50"><XCircle size={15} /></button></> : <><button onClick={() => openEdit(sale)} className="p-1.5 border border-oro/25 rounded-lg text-choco/70 hover:bg-crema transition-colors"><Pencil size={14} /></button><button onClick={() => setConfirming(sale.id)} className="p-1.5 border border-oro/25 rounded-lg text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button></>}</div></div></div></Card>)}</div>}</div>;
}

function SimpleExpenseHistory({ expenses }) {
  return expenses.length === 0 ? <EmptyState>No hay gastos registrados.</EmptyState> : <div className="space-y-2">{expenses.map((expense) => <Card key={expense.id} className="p-4 flex justify-between gap-3"><div><p className="font-semibold">{expense.description}</p><p className="text-xs text-choco/45">{fmtDate(expense.dateISO)} · {expense.category} · {expense.supplierName}</p></div><p className="font-bold">{CLP(expense.total)}</p></Card>)}</div>;
}
