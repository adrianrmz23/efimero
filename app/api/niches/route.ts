import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getMetaPages } from "@/lib/metaServer";

export const dynamic = "force-dynamic";
const phases = new Set(["testing", "winner", "promising", "pivot"]);
const dateOnly = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(`${value}T12:00:00Z`).getTime());
function respond(message:string,status=400){return NextResponse.json({error:message},{status});}
async function authenticate(){const user=await getServerUser();return user;}

export async function GET(){
  try{
    const user=await authenticate();if(!user)return respond("Inicia sesión para abrir el laboratorio.",401);
    const admin=getSupabaseAdmin();
    const [experiments,metrics]=await Promise.all([
      admin.from("efimero_niche_experiments").select("id,niche,page_id,start_date,duration_days,phase,created_at").eq("owner_user_id",user.id).order("created_at"),
      admin.from("efimero_niche_metrics").select("id,experiment_id,recorded_date,reach,interactions,qualified_views,followers_net,production_cost,published_posts,published_reels,source").eq("owner_user_id",user.id).order("recorded_date"),
    ]);
    if(experiments.error||metrics.error)throw experiments.error||metrics.error;
    return NextResponse.json({experiments:experiments.data||[],metrics:metrics.data||[],storage:"supabase"});
  }catch(e:any){return respond(e?.message||"No se pudieron cargar los experimentos.",500)}
}

export async function POST(request:NextRequest){
  try{
    const user=await authenticate();if(!user)return respond("Inicia sesión.",401);
    const body=await request.json().catch(()=>({}));
    const action=String(body.action||"");const admin=getSupabaseAdmin();
    if(action==="experiment"){
      const niche=String(body.niche||"").trim();
      const pageId=String(body.pageId||"").trim();
      const date=String(body.startDate||"").trim();
      if(!niche||niche.length>75||!dateOnly(date))return respond("Nicho o fecha inválidos.");
      if(pageId){const {pages}=await getMetaPages(user.id);if(!pages.some((p:any)=>String(p.page_id)===pageId))return respond("Selecciona una página de Meta conectada a tu cuenta.",403);}
      const {data:current,error:readError}=await admin.from("efimero_niche_experiments").select("id,niche,start_date,duration_days,phase").eq("owner_user_id",user.id);
      if(readError)throw readError;
      const existing=(current||[]).find(x=>x.niche===niche);
      if(!existing){
        if((current||[]).length>=5)return respond("Solo puedes probar cinco nichos en esta ronda.");
        if((current||[]).length>=3 && !(current||[]).some(x=>x.phase!=="testing"))return respond("La fase 4 se habilita después de clasificar algún nicho tras su prueba.");
      }else if(existing.start_date!==date){return respond("La fecha de inicio no puede modificarse después de crear el experimento.");}
      const {data,error}=await admin.from("efimero_niche_experiments").upsert({owner_user_id:user.id,niche,page_id:pageId||null,start_date:date,duration_days:30},{onConflict:"owner_user_id,niche"}).select().single();
      if(error)throw error;
      return NextResponse.json({experiment:data});
    }
    if(action==="metrics"){
      const id=String(body.experimentId||"");const date=String(body.date||"");
      if(date>new Date().toISOString().slice(0,10))return respond("No se pueden registrar métricas futuras.");
      if(!/^[a-f0-9-]{36}$/i.test(id)||!dateOnly(date))return respond("Experimento o fecha inválidos.");
      const {data:experiment,error:err}=await admin.from("efimero_niche_experiments").select("id,start_date,duration_days").eq("id",id).eq("owner_user_id",user.id).maybeSingle();
      if(err||!experiment)return respond("Experimento no encontrado.",404);
      const start=new Date(`${experiment.start_date}T12:00:00Z`).getTime();const at=new Date(`${date}T12:00:00Z`).getTime();
      if(at<start||at>=start+Number(experiment.duration_days)*86400_000)return respond("La fecha debe estar dentro del período de 30 días.");
      const parsed:Record<string,number|null>={};
      for(const field of ["reach","interactions","qualified_views","followers_net","production_cost","published_posts","published_reels"]){
        const raw=body[field];
        if(raw===null||raw===undefined||String(raw).trim()===""){parsed[field]=null;continue}
        const value=Number(raw);
        if(!Number.isFinite(value)||Math.abs(value)>1_000_000_000|| (field!=="followers_net"&&value<0)|| (field!=="production_cost"&&!Number.isInteger(value)))return respond(`Valor no válido: ${field}.`);
        parsed[field]=value;
      }
      const {data,error}=await admin.from("efimero_niche_metrics").upsert({owner_user_id:user.id,experiment_id:id,recorded_date:date,...parsed,source:"manual",updated_at:new Date().toISOString()},{onConflict:"experiment_id,recorded_date"}).select().single();
      if(error)throw error;
      return NextResponse.json({metric:data});
    }
    if(action==="phase"){
      const id=String(body.experimentId||"");const phase=String(body.phase||"");
      if(!phases.has(phase)||!/^[a-f0-9-]{36}$/i.test(id))return respond("Fase o ID inválidos.");
      const {data:experiment}=await admin.from("efimero_niche_experiments").select("start_date,duration_days").eq("id",id).eq("owner_user_id",user.id).maybeSingle();
      if(!experiment)return respond("Experimento no encontrado.",404);
      const elapsed=Math.floor((Date.now()-new Date(`${experiment.start_date}T00:00:00Z`).getTime())/86400_000);
      if(phase!=="testing"&&elapsed<Number(experiment.duration_days))return respond("La clasificación se desbloquea al concluir los 30 días.");
      const {data,error}=await admin.from("efimero_niche_experiments").update({phase,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_user_id",user.id).select().single();
      if(error)throw error;
      return NextResponse.json({experiment:data});
    }
    return respond("Acción no reconocida.");
  }catch(e:any){return respond(e?.message||"No fue posible guardar los datos.",500)}
}
