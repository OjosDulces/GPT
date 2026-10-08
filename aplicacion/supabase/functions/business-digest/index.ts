import {adminClient,setting,siteOrigin} from '../_shared/http.ts';
import {dayKey,shiftDay,summarize} from '../_shared/intelligence.js';
// Trigger with a scheduler. Never accepts an arbitrary destination or business ID.
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!setting('DIGEST_SECRET')||req.headers.get('authorization')!==`Bearer ${setting('DIGEST_SECRET')}`)return new Response('Unauthorized',{status:401});
 const admin=adminClient();let offset=0,created=0,failed=0;
 while(true){
  const {data:rows,error}=await admin.from('business_data').select('business_id,profile,sales,expenses').order('business_id').range(offset,offset+99);
  if(error)return Response.json({error:'No fue posible generar los informes.',created,failed},{status:500});
  for(const row of rows||[]){
   if(row.profile?.weeklyReports!==true)continue;
   const {data:plan,error:planError}=await admin.rpc('effective_business_plan',{p_business_id:row.business_id});if(planError||!['inteligente','negocio'].includes(plan))continue;
   const today=dayKey(new Date(),row.profile.timezone||'America/Santiago'),weekday=new Date(`${today}T12:00:00Z`).getUTCDay();
   const monday=shiftDay(today,-((weekday+6)%7)),to=shiftDay(monday,-1),from=shiftDay(to,-6),summary=summarize(row,{from,to});
   const {error:saveError}=await admin.from('automatic_reports').upsert({business_id:row.business_id,period_start:from,period_end:to,summary},{onConflict:'business_id,period_start,period_end',ignoreDuplicates:true});
   if(saveError){failed++;continue;}else created++;
   if(row.profile.weeklyEmail!==true||setting('EMAIL_ENABLED')!=='true'||!setting('RESEND_API_KEY')||!setting('EMAIL_FROM'))continue;
   const {data:report}=await admin.from('automatic_reports').select('id,summary,email_status').eq('business_id',row.business_id).eq('period_start',from).eq('period_end',to).single();
   if(!report||report.email_status!=='pending')continue;
   const {data:business}=await admin.from('businesses').select('owner_id').eq('id',row.business_id).single();if(!business)continue;
   const {data:account}=await admin.auth.admin.getUserById(business.owner_id);
   const recipient=account?.user;if(!recipient?.email||!recipient.email_confirmed_at)continue;
   const {data:claimed,error:claimError}=await admin.rpc('claim_report_email',{p_id:report.id});if(claimError||!claimed)continue;
   const m=report.summary, money=(n:number)=>`${row.profile.currency||'CLP'} ${Number(n).toLocaleString('es-CL')}`;
   const message=`Tu informe semanal de Control Emprende\n${from} al ${to}\n\nVentas registradas: ${money(m.revenue)}\nCobrado: ${money(m.collected)}\nEgresos pagados: ${money(m.paidExpenses)}\nResultado estimado: ${money(m.estimatedProfit)}\nSaldo por cobrar al generar este informe: ${money(m.receivables)}\n\n${m.missingCosts?'Hay ventas con costos incompletos; el resultado puede estar sobrevalorado.':'El resultado considera solamente las operaciones registradas.'}\n\nRevisa el detalle en ${siteOrigin()}/app\nPuedes desactivar estos correos en Metas y asesor.\n`;
   try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${setting('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':`ce-weekly-${report.id}`},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:setting('EMAIL_FROM'),to:[recipient.email],subject:`Tu negocio esta semana · ${from} al ${to}`,text:message})});
    if(!response.ok)throw new Error('Email provider error');const sent=await response.json();
    const {error:markError}=await admin.from('automatic_reports').update({email_status:'sent',email_id:sent.id}).eq('id',report.id);
    if(markError)failed++;
   }catch{await admin.from('automatic_reports').update({email_status:'review'}).eq('id',report.id);failed++;}
  }
  if((rows||[]).length<100)break;offset+=100;
 }
 return Response.json({processed:created,failed});
});
