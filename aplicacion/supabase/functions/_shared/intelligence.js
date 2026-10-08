// Pure analysis, shared by the browser, scheduled jobs and the AI endpoint.
// All predictions are linear scenarios, never guarantees or bank balances.
export const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = (rows, field) => rows.reduce((total, row) => total + numeric(row[field]), 0);
const round = n => Math.round(n * 100) / 100;
export function dayKey(value = new Date(), timezone = 'America/Santiago') {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  let parts;
  try { parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date); }
  catch { parts = new Intl.DateTimeFormat('en-CA', { timeZone:'UTC', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date); }
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftDay(key, days) { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
const daysBetween = (a,b) => Math.round((Date.parse(`${b}T12:00:00Z`)-Date.parse(`${a}T12:00:00Z`))/86400000);
const validSale = s => !s.cancelledAt && !['Anulado','Cancelado'].includes(s.orderStatus);
export function periodRange(period, today) {
  return { from: period === 'day' ? today : period === 'week' ? shiftDay(today,-6) : `${today.slice(0,7)}-01`, to:today };
}
export function summarize(data, range, timezone = data.profile?.timezone || 'America/Santiago') {
  const within = value => { if(!value)return false;const d = dayKey(value,timezone); return Boolean(d && d>=range.from && d<=range.to); };
  const all = (data.sales || []).filter(validSale), sales = all.filter(s=>within(s.dateISO));
  const expenses = (data.expenses || []).filter(e=>within(e.dateISO));
  const collections = all.flatMap(s=>Array.isArray(s.payments)?s.payments:[]).filter(p=>within(p.dateISO));
  const disbursements = (data.expenses || []).filter(e=>e.paymentStatus==='Pagado' && within(e.paidAt || e.dateISO));
  const revenue = sum(sales,'total'), cost = sum(sales,'cost');
  // Inventory purchases affect cash, but are not deducted twice from profit.
  const operatingExpenses = sum(expenses.filter(e=>e.type!=='Compra' && !e.items?.some(i=>i.insumoId)),'total');
  const missingCosts = sales.filter(s=>s.costKnown===false || s.cost==null || (numeric(s.cost)===0 && !s.zeroCostConfirmed)).length;
  return { ...range, revenue:round(revenue), cost:round(cost), collected:round(sum(collections,'amount')), paidExpenses:round(sum(disbursements,'total')), cashFlow:round(sum(collections,'amount')-sum(disbursements,'total')), operatingExpenses:round(operatingExpenses), grossProfit:round(revenue-cost), estimatedProfit:round(revenue-cost-operatingExpenses), margin:revenue>0?round((revenue-cost)/revenue*100):null, count:sales.length, missingCosts, receivables:round(all.reduce((a,s)=>a+Math.max(0,numeric(s.total)-numeric(s.paidAmount)),0)), payables:round(sum((data.expenses || []).filter(e=>e.paymentStatus!=='Pagado'),'total')), undatedCollections:round(all.reduce((a,s)=>a+numeric(Array.isArray(s.payments)?s.legacyPaidAmount:s.paidAmount),0)) };
}
export function analyzeBusiness(data, now = new Date()) {
  const profile = data.profile || {}, tz = profile.timezone || 'America/Santiago', today = dayKey(now,tz);
  const sales = (data.sales || []).filter(s=>validSale(s) && s.dateISO && dayKey(s.dateISO,tz) && dayKey(s.dateISO,tz)<=today);
  const products = (data.products || []).filter(p=>p.active!==false);
  const from = shiftDay(today,-29), previousFrom = shiftDay(from,-30), previousTo = shiftDay(from,-1);
  const first = sales.map(s=>dayKey(s.dateISO,tz)).sort()[0] || today;
  const observedDays = Math.max(1,Math.min(30,daysBetween(first,today)+1));
  const current = summarize({...data,sales},{from,to:today},tz), previous = summarize({...data,sales},{from:previousFrom,to:previousTo},tz);
  const monthly = summarize({...data,sales},periodRange('month',today),tz);
  const comparable = first<=previousFrom && previous.count>=3 && current.count>=3;
  const growth = comparable && previous.revenue>0 ? round((current.revenue/previous.revenue-1)*100) : null;
  const alerts = [];
  const add = (id,severity,title,explanation,action,target,penalty=0,extra={}) => alerts.push({id,severity,title,explanation,action,target,penalty,...extra});
  const pending = sales.filter(s=>numeric(s.total)>numeric(s.paidAmount));
  // Delivery dates are not payment deadlines. Without an explicit due date no overdue claim is made.
  const overdue = pending.filter(s=>s.paymentDueDate && s.paymentDueDate<today);
  const oldPending = pending.filter(s=>!s.paymentDueDate && daysBetween(dayKey(s.dateISO,tz),today)>=30);
  if(overdue.length) add('overdue','urgent',`${overdue.length} cobros vencidos`, 'La fecha de vencimiento registrada ya pasó y queda saldo pendiente.','Revisar cobros','pedidos',20,{amount:round(overdue.reduce((a,s)=>a+numeric(s.total)-numeric(s.paidAmount),0))});
  if(oldPending.length) add('old-pending','important',`${oldPending.length} saldos llevan 30 días o más`,'No tienen fecha de vencimiento; no se clasifican como morosidad. Confirma el acuerdo de pago.','Revisar saldos','pedidos',5);
  if(current.missingCosts) add('missing-cost','important',`${current.missingCosts} ventas con costo incompleto`,'La ganancia estimada puede estar sobrevalorada. Completa los costos antes de decidir precios.','Revisar costos','costos',10);
  if(current.undatedCollections>0) add('undated-payments','info','Hay cobros históricos sin fecha','Estos cobros están en el total pagado, pero no en el flujo del período.','Revisar registros','historial');
  const losses = sales.filter(s=>dayKey(s.dateISO,tz)>=from && s.costKnown!==false && numeric(s.cost)>numeric(s.total));
  if(losses.length) add('loss','urgent',`${losses.length} ventas bajo su costo registrado`,'El total final, incluidos descuentos, es menor que el costo guardado en la venta.','Revisar precios','costos',25);
  if(growth!==null && growth<=-20) add('sales-down','important',`Las ventas bajaron ${Math.abs(growth).toFixed(1)}%`,'Compara dos ventanas completas de 30 días. No identifica la causa ni ajusta estacionalidad.','Ver reportes','informes',15);
  if(current.cashFlow<0 && current.count>=3) add('cash-out','important','Salió más dinero del que entró en 30 días','Usa cobros con fecha y egresos pagados; puede incluir compras de inventario. No equivale a pérdida ni a saldo bancario negativo.','Revisar caja','finanzas',10,{amount:Math.abs(current.cashFlow)});
  const forecasts = [];
  for(const p of products.filter(p=>p.trackStock!==false)) {
    const lines = sales.filter(s=>dayKey(s.dateISO,tz)>=from).flatMap(s=>(s.items||[]).filter(i=>i.productId===p.id).map(i=>({...i,day:dayKey(s.dateISO,tz)})));
    const distinctDays = new Set(lines.map(i=>i.day)).size;
    const units = sum(lines,'qty'), rate = units/observedDays, enough = observedDays>=14 && distinctDays>=3;
    const stock = numeric(p.stock), min = numeric(p.minStock);
    const daysLeft = enough && rate>0 ? Math.floor(stock/rate) : null;
    forecasts.push({id:p.id,name:p.name,stock,min,units,rate:round(rate),daysLeft,observedDays,distinctDays});
    if(stock<=min) add(`stock-${p.id}`,stock===0?'urgent':'important',`${p.name}: ${stock} disponibles`,`Tu mínimo es ${min}. ${daysLeft!==null?`Al ritmo observado, la cobertura es de unos ${daysLeft} días.`:'Aún no hay historial suficiente para estimar la fecha de agotamiento.'}`,'Revisar inventario','inventario',stock===0?8:4,{productId:p.id});
    else if(daysLeft!==null && daysLeft<=numeric(p.leadTimeDays ?? profile.leadTimeDays ?? 7)) add(`forecast-${p.id}`,'important',`${p.name}: cobertura aproximada de ${daysLeft} días`,`Promedio de ${round(rate)} unidades al día en ${observedDays} días observados. Supone demanda constante y ninguna reposición.`,'Planificar reposición','inventario',4,{productId:p.id});
  }
  const productPerformance = products.map(p=>{
    const lines=sales.filter(s=>dayKey(s.dateISO,tz)>=from).flatMap(s=>(s.items||[]).filter(i=>i.productId===p.id).map(i=>({...i, net:numeric(i.price)*numeric(i.qty)*(1-(numeric(s.subtotal)>0?Math.min(1,numeric(s.discount)/numeric(s.subtotal)):0))})));
    const revenue=sum(lines,'net'),cost=lines.reduce((a,i)=>a+numeric(i.unitCost)*numeric(i.qty),0), known=lines.length>0&&lines.every(i=>i.unitCost!=null&&numeric(i.unitCost)>0&&i.costKnown!==false);
    return {id:p.id,name:p.name,revenue:round(revenue),cost:round(cost),profit:known?round(revenue-cost):null,margin:known&&revenue>0?round((revenue-cost)/revenue*100):null,units:sum(lines,'qty')};
  }).sort((a,b)=>numeric(b.profit)-numeric(a.profit));
  if(productPerformance[0]?.profit>0) add('best-product','opportunity',`${productPerformance[0].name} aporta más margen bruto`,'Es el mayor aporte registrado en los últimos 30 días, antes de gastos generales. Considera su demanda y disponibilidad.','Ver productos','costos');
  const inactiveCustomers=(data.customers || []).map(c=>{
    const dates=sales.filter(s=>s.customerId===c.id).map(s=>dayKey(s.dateISO,tz)).sort();
    const distinct=[...new Set(dates)];
    if(distinct.length<3)return null;
    const interval=daysBetween(distinct[0],distinct.at(-1))/(distinct.length-1), elapsed=daysBetween(distinct.at(-1),today);
    return elapsed>Math.max(30,interval*1.5)?{id:c.id,name:c.name,days:elapsed,interval:Math.round(interval)}:null;
  }).filter(Boolean);
  if(inactiveCustomers.length) add('inactive','opportunity',`${inactiveCustomers.length} clientes habituales llevan más tiempo sin comprar`,'Tienen al menos tres fechas de compra; el tiempo transcurrido supera 1,5 veces su intervalo medio y 30 días.','Revisar clientes','clientes');
  const severityOrder={urgent:0,important:1,opportunity:2,info:3}; alerts.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]);
  const sufficient = sales.length>=5 && observedDays>=14;
  const penalties=alerts.filter(a=>a.penalty>0), score=sufficient?Math.max(0,100-Math.min(100,penalties.reduce((a,b)=>a+b.penalty,0))):null;
  const health=score===null?'Aprendiendo':alerts.some(a=>a.severity==='urgent')?'Revisar ahora':score<80?'Atención recomendada':'Sin alertas críticas';
  const monthLast=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),0)).getUTCDate(),daysLeftInMonth=monthLast-Number(today.slice(8,10))+1;
  const goal=numeric(profile.monthlyGoal),remaining=Math.max(0,goal-monthly.revenue);
  return {version:1,asOf:today,timezone:tz,observedDays,current,previous,monthly,growth,comparable,alerts,forecasts,productPerformance,inactiveCustomers,health,score,sufficient,penalties,goal:{target:goal,current:monthly.revenue,remaining,dailyNeeded:round(remaining/daysLeftInMonth),daysLeft:daysLeftInMonth},limitations:['Solo analiza registros ingresados.','Las proyecciones suponen demanda constante.','El indicador es orientativo, no una calificación financiera.']};
}
export function localAdvice(question, analysis, money = n=>String(n)) {
  const q=question.toLocaleLowerCase('es');
  if(/stock|inventario|agot|repon/.test(q))return analysis.forecasts.length?analysis.forecasts.slice(0,6).map(p=>`${p.name}: ${p.stock} unidades. ${p.daysLeft===null?'Todavía no hay historial suficiente para proyectar el agotamiento.':`Cobertura aproximada: ${p.daysLeft} días al ritmo observado.`}`).join('\n'):'No hay productos con control de stock. Puedes agregarlos en Productos.';
  if(/cobr|deud|cliente/.test(q))return `Tienes ${money(analysis.current.receivables)} por cobrar en total. ${analysis.alerts.find(a=>a.id==='overdue')?.title || 'No se detectan saldos con una fecha de vencimiento pasada.'} Revisa Pedidos y pagos antes de contactar a tus clientes.`;
  if(/gan|margen|rentab|costo/.test(q))return `En los últimos 30 días registraste ventas por ${money(analysis.current.revenue)}, costos de venta por ${money(analysis.current.cost)} y gastos operativos por ${money(analysis.current.operatingExpenses)}. Resultado estimado: ${money(analysis.current.estimatedProfit)}. ${analysis.current.missingCosts?'Hay costos incompletos: esta estimación puede estar sobrevalorada.':'No incluye gastos que no hayas registrado ni impuestos calculados externamente.'}`;
  if(/semana/.test(q))return 'Abre Informes y selecciona «Semana» para ver ventas, cobros, gastos y el resultado estimado de los últimos siete días.';
  if(/como|cómo|negocio|hacer|prioridad|problema|riesgo|revisar|hoy/.test(q))return `${analysis.health}. ${analysis.score===null?'Necesito al menos 14 días y cinco ventas para calcular el indicador.':`Indicador orientativo: ${analysis.score}/100.`}\n${analysis.alerts.slice(0,3).map((a,i)=>`${i+1}. ${a.title}. ${a.action}.`).join('\n') || 'No hay alertas con los registros actuales. Sigue registrando ventas y gastos.'}`;
  return 'Puedo explicar tu caja, margen, cobros, inventario y prioridades con los datos registrados. Prueba «¿Qué debería revisar hoy?» o activa el asesor en línea para una consulta más específica.';
}
