import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getMetaConnection, getMetaPages } from "@/lib/metaServer";

const isoDaysAgo=(days:number)=>new Date(Date.now()-days*86400000).toISOString();

export async function generateWeeklyReport(ownerUserId:string,pageIdInput?:string){
  const admin=getSupabaseAdmin();const connection=await getMetaConnection(ownerUserId);const pageId=String(pageIdInput||connection?.active_page_id||"");const pages=await getMetaPages(ownerUserId);const page=pages.pages.find((x:any)=>String(x.page_id)===pageId);const pageName=String(page?.page_name||"Página activa");
  const since=isoDaysAgo(7);const previous=isoDaysAgo(14);
  const [publishedQ,snapshotsQ,complianceQ,experimentsQ,agentQ,fatigueQ,previousPublishedQ]=await Promise.all([
    admin.from("efimero_scheduled_posts").select("id,text,category,status,published_at_actual,publish_at,meta_post_id,editorial_score").eq("page_id",pageId).or("status.eq.Publicado,status.eq.published").gte("publish_at",since).limit(300),
    admin.from("efimero_metric_snapshots").select("scheduled_post_id,reactions,comments,shares,performance_score,checkpoint,collected_at").eq("page_id",pageId).gte("collected_at",since).limit(1000),
    admin.from("efimero_compliance_reviews").select("status,score,created_at").gte("created_at",since).limit(500),
    admin.from("efimero_copy_experiments").select("dimension,status,created_at,variants").eq("page_id",pageId).gte("created_at",since).limit(100),
    admin.from("efimero_agent_runs").select("id,created_at,plan").eq("page_id",pageId).gte("created_at",since).limit(100),
    admin.from("efimero_fatigue_snapshots").select("score,snapshot,created_at").order("created_at",{ascending:false}).limit(1).maybeSingle(),
    admin.from("efimero_scheduled_posts").select("id").eq("page_id",pageId).or("status.eq.Publicado,status.eq.published").gte("publish_at",previous).lt("publish_at",since).limit(500),
  ]);
  const published=publishedQ.data||[];const snapshots=snapshotsQ.data||[];const latestByPost=new Map<string,any>();for(const s of snapshots){const old=latestByPost.get(String(s.scheduled_post_id));if(!old||new Date(s.collected_at).getTime()>new Date(old.collected_at).getTime())latestByPost.set(String(s.scheduled_post_id),s)}
  const metrics=[...latestByPost.values()];const total={reactions:metrics.reduce((n,x)=>n+Number(x.reactions||0),0),comments:metrics.reduce((n,x)=>n+Number(x.comments||0),0),shares:metrics.reduce((n,x)=>n+Number(x.shares||0),0),score:metrics.length?metrics.reduce((n,x)=>n+Number(x.performance_score||0),0)/metrics.length:0};
  const byCategory=new Map<string,{count:number,score:number,shares:number}>();for(const p of published){const m=latestByPost.get(String(p.id));const key=String(p.category||"General");const row=byCategory.get(key)||{count:0,score:0,shares:0};row.count++;row.score+=Number(m?.performance_score||0);row.shares+=Number(m?.shares||0);byCategory.set(key,row)}
  const categories=[...byCategory.entries()].map(([category,x])=>({category,count:x.count,avgScore:x.count?x.score/x.count:0,shares:x.shares})).sort((a,b)=>b.avgScore-a.avgScore);
  const compliance=complianceQ.data||[];const compliancePass=compliance.filter((x:any)=>x.status==="pass").length;const complianceRate=compliance.length?compliancePass/compliance.length:1;
  const context={pageId,pageName,period:{from:since,to:new Date().toISOString()},published:published.length,previousPublished:previousPublishedQ.data?.length||0,metrics:total,categories,compliance:{reviews:compliance.length,passRate:complianceRate},experiments:experimentsQ.data?.length||0,agentRuns:agentQ.data?.length||0,fatigue:fatigueQ.data||null};
  let report:any={summary:`Esta semana se publicaron ${published.length} textos en ${pageName}.`,wins:categories.slice(0,2).map(x=>`${x.category} mostró la mejor señal promedio dentro de la muestra.`),risks:fatigueQ.data&&Number(fatigueQ.data.score||0)>=65?["La fatiga editorial está elevada; conviene ampliar categorías y hooks."]:[],experiments:[`${experimentsQ.data?.length||0} experimentos registrados esta semana.`],nextWeek:["Mantener Compliance obligatorio y probar variaciones de categorías con menor fatiga.","Usar el dataset editorial para recuperar ejemplos relevantes sin copiar históricos."],note:"Las conclusiones describen la muestra disponible y no garantizan distribución, viralidad ni monetización."};
  const key=process.env.OPENAI_API_KEY;
  if(key){
    const prompt=`Eres director editorial de Efímero. Redacta un reporte semanal útil y conservador a partir de estos datos reales: ${JSON.stringify(context)}. No inventes métricas. No predigas viralidad. Distingue señal observada de recomendación. Da máximo 4 wins, 4 risks, 4 experiments y 5 nextWeek. El reporte debe enfocarse en textos y cumplir políticas de Meta.`;
    try{const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5-mini",input:prompt,text:{format:{type:"json_schema",name:"efimero_weekly_report",schema:{type:"object",additionalProperties:false,properties:{summary:{type:"string"},wins:{type:"array",items:{type:"string"}},risks:{type:"array",items:{type:"string"}},experiments:{type:"array",items:{type:"string"}},nextWeek:{type:"array",items:{type:"string"}},note:{type:"string"}},required:["summary","wins","risks","experiments","nextWeek","note"]}}}})});if(r.ok){const d=await r.json();const output=d.output_text||d.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;report=JSON.parse(output||"{}")}}catch{}
  }
  const {data:saved,error}=await admin.from("efimero_weekly_reports").insert({owner_user_id:ownerUserId,page_id:pageId,page_name:pageName,period_start:since,period_end:new Date().toISOString(),metrics:context,report}).select("id,created_at").single();if(error)throw error;
  return {id:saved.id,createdAt:saved.created_at,context,report};
}
