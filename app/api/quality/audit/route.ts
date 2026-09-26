import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getMetaConnection } from "@/lib/metaServer";
import { META_RULESET_VERSION } from "@/lib/metaCompliance";

export const dynamic="force-dynamic";
export async function GET(){
  const user=await getServerUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  try{
    const admin=getSupabaseAdmin();const connection=await getMetaConnection(user.id);const now=Date.now();
    const [jobsQ,scheduleQ,datasetQ,reportsQ,agentQ,scoresQ]=await Promise.all([
      admin.from("efimero_publish_jobs").select("state,last_error,updated_at").in("state",["failed","retry","blocked"]).limit(100),
      admin.from("efimero_scheduled_posts").select("id,status,compliance_data,publish_at,text,fingerprint").in("status",["Aprobado","approved","Programado","scheduled"]).limit(500),
      admin.from("efimero_editorial_dataset").select("id",{count:"exact",head:true}),
      admin.from("efimero_weekly_reports").select("created_at").eq("owner_user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      admin.from("efimero_agent_runs").select("created_at").eq("owner_user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      admin.from("efimero_editorial_scores").select("id",{count:"exact",head:true}).eq("owner_user_id",user.id),
    ]);
    const schedule=scheduleQ.data||[];const withoutPass=schedule.filter((x:any)=>x.compliance_data?.status!=="pass").length;const fp=new Map<string,number>();for(const row of schedule){const key=String(row.fingerprint||row.text||"").trim();if(key)fp.set(key,(fp.get(key)||0)+1)}const duplicateCount=[...fp.values()].filter(x=>x>1).reduce((n,x)=>n+x-1,0);
    const failed=(jobsQ.data||[]).filter((x:any)=>x.state==="failed").length;const retry=(jobsQ.data||[]).filter((x:any)=>x.state==="retry").length;const blocked=(jobsQ.data||[]).filter((x:any)=>x.state==="blocked").length;
    const tokenExpiry=connection?.user_token_expires_at?new Date(connection.user_token_expires_at).getTime():0;const tokenDays=tokenExpiry?Math.floor((tokenExpiry-now)/86400000):null;
    const checks=[
      {id:"auth",label:"Login privado",status:"pass",detail:user.email},
      {id:"supabase",label:"Supabase service role",status:process.env.SUPABASE_SERVICE_ROLE_KEY?"pass":"fail",detail:process.env.SUPABASE_SERVICE_ROLE_KEY?"Configurado":"Falta SUPABASE_SERVICE_ROLE_KEY"},
      {id:"meta",label:"Meta OAuth",status:connection?.status==="connected"?"pass":"fail",detail:connection?.status||"Sin conexión"},
      {id:"meta-token",label:"Vigencia del User Token",status:tokenDays===null?"warn":tokenDays<=7?"warn":"pass",detail:tokenDays===null?"Sin fecha reportada":`${tokenDays} días restantes`},
      {id:"openai",label:"OpenAI",status:process.env.OPENAI_API_KEY?"pass":"fail",detail:process.env.OPENAI_API_KEY?"Configurado":"Falta OPENAI_API_KEY"},
      {id:"brightdata",label:"Bright Data Radar",status:process.env.BRIGHTDATA_API_KEY&&process.env.BRIGHTDATA_FACEBOOK_POSTS_DATASET_ID?"pass":"warn",detail:process.env.BRIGHTDATA_API_KEY&&process.env.BRIGHTDATA_FACEBOOK_POSTS_DATASET_ID?"Configurado":"Faltan credenciales del Radar externo"},
      {id:"cron",label:"CRON_SECRET",status:process.env.CRON_SECRET?"pass":"warn",detail:process.env.CRON_SECRET?"Configurado":"Sin automatización externa protegida"},
      {id:"dataset",label:"Dataset editorial",status:(datasetQ.count||0)>=50?"pass":(datasetQ.count||0)>0?"warn":"fail",detail:`${datasetQ.count||0} textos indexados`},
      {id:"compliance",label:"Compliance en cola",status:withoutPass===0?"pass":"warn",detail:withoutPass?`${withoutPass} piezas aprobadas/programadas sin PASS`:"Todas las piezas activas tienen PASS"},
      {id:"duplicates",label:"Duplicados en cola",status:duplicateCount===0?"pass":"warn",detail:duplicateCount?`${duplicateCount} duplicados potenciales`:"Sin duplicados detectados"},
      {id:"publish-jobs",label:"Jobs de publicación",status:failed?"fail":retry||blocked?"warn":"pass",detail:`${failed} fallidos · ${retry} reintentos · ${blocked} bloqueados`},
      {id:"weekly-report",label:"Reporte semanal",status:reportsQ.data?.created_at&&now-new Date(reportsQ.data.created_at).getTime()<9*86400000?"pass":"warn",detail:reportsQ.data?.created_at?new Date(reportsQ.data.created_at).toLocaleDateString("es-MX"):"Todavía no generado"},
      {id:"legacy-token",label:"Token manual antiguo",status:process.env.META_USER_ACCESS_TOKEN?"warn":"pass",detail:process.env.META_USER_ACCESS_TOKEN?"Conviene eliminar META_USER_ACCESS_TOKEN":"OAuth es la única fuente de tokens"},
      {id:"policies",label:"Ruleset Meta",status:"pass",detail:META_RULESET_VERSION},
      {id:"legal",label:"Páginas legales",status:"pass",detail:"/privacy · /terms · /data-deletion"},
    ];
    const fail=checks.filter(x=>x.status==="fail").length,warn=checks.filter(x=>x.status==="warn").length;const score=Math.max(0,Math.round(100-fail*14-warn*5));
    const result={score,level:fail?"attention":warn?"good":"ready",checks,counts:{dataset:datasetQ.count||0,scores:scoresQ.count||0,schedule:schedule.length,withoutPass,duplicates:duplicateCount,failed,retry,blocked},lastAgentRun:agentQ.data?.created_at||null,checkedAt:new Date().toISOString()};
    await admin.from("efimero_quality_audits").insert({owner_user_id:user.id,score,level:result.level,checks,counts:result.counts});
    return NextResponse.json({ok:true,result});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible ejecutar la auditoría."},{status:500})}
}
