export const PLANS = Object.freeze([
  {id:'gratis',name:'Gratis',price:0,sales:50,products:30,members:1,ai:false,description:'Para ordenar tus primeras ventas.',features:['50 ventas al mes','30 productos o servicios','Ventas, cobros y clientes','Alertas básicas y respaldos']},
  {id:'emprendedor',name:'Emprendedor',price:4990,sales:500,products:500,members:1,ai:false,description:'El día a día de tu negocio, conectado.',features:['500 ventas al mes','500 productos o servicios','Inventario, gastos e importación','Reportes y metas']},
  {id:'inteligente',name:'Inteligente',price:9990,sales:2000,products:2000,members:1,ai:true,description:'Anticípate y entiende tus números.',features:['2.000 ventas al mes','2.000 productos o servicios','Asesor en línea y proyecciones','Informes semanales automáticos']},
  {id:'negocio',name:'Negocio',price:19990,sales:10000,products:5000,members:5,ai:true,description:'Un mismo negocio, todo tu equipo.',features:['10.000 ventas al mes','5.000 productos o servicios','Hasta 5 usuarios con permisos','Incluye todas las funciones']},
]);
export const getPlan=id=>PLANS.find(p=>p.id===id)||PLANS[0];
export function validatePayment(order, response) {
  return response.status==='AUTHORIZED' && response.response_code===0 && Number(response.amount)===Number(order.amount) && response.buy_order===order.buy_order && response.session_id===order.id;
}

