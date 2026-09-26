import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getMetaConnection, getMetaPages } from "@/lib/metaServer";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";
import { evaluateEditorialText } from "@/lib/editorialScoring";

const categoryFallback=["Frases identificables","Relaciones","Nostalgia","Vida cotidiana","Preguntas","Humor","Motivación ligera"];
const textFallback=[
  "A veces la paz empieza justo donde dejas de insistir.",
  "Hay recuerdos que no duelen, pero todavía saben cómo encontrarte.",
  "Qué bonito cuando alguien no te obliga a adivinar si le importas.",
  "La adultez también es emocionarte porque cancelaron el plan que no querías cancelar tú.",
  "No todo lo que soltaste era una pérdida.",
  "¿Qué pequeña cosa logra mejorar un día pesado sin hacer mucho ruido?",
  "Hay versiones de ti que solo existen en ciertos lugares y canciones.",
  "Descansar también cuenta cuando llevas demasiado tiempo sosteniendo todo.",
];
const pad=(n:number)=>String(n).padStart(2,"0");
const localDate=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const addDays=(iso:string,days:number)=>{const d=new Date(`${iso}T12:00:00-06:00`);d.setUTCDate(d.getUTCDate()+days);return localDate(d)};

export async function POST(request:NextRequest){
  const user=await getServerUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  const body=await request.json().catch(()=>({}));
  const horizon=Math.max(3,Math.min(14,Number(body.horizonDays||7)));
  const perDay=Math.max(1,Math.min(6,Number(body.perDay||3)));
  const objective=String(body.objective||"Equilibrado");
  const maxItems=Math.max(1,Math.min(8,Number(body.maxItems||8)));
  try{
    const admin=getSupabaseAdmin();
    const connection=await getMetaConnection(user.id);
    const pageId=String(body.pageId||connection?.active_page_id||"");
    if(!pageId)return NextResponse.json({error:"Selecciona una página activa en Meta."},{status:400});
    const pagesInfo=await getMetaPages(user.id);const page=pagesInfo.pages.find((x:any)=>String(x.page_id)===pageId);const pageName=String(page?.page_name||"Página de Facebook");
    const start=localDate(new Date());const end=addDays(start,horizon-1);
    const [scheduledQ,fatigueQ,learningQ,datasetQ]=await Promise.all([
      admin.from("efimero_scheduled_posts").select("publish_at,category,text,status").eq("page_id",pageId).gte("publish_at",`${start}T00:00:00`).lte("publish_at",`${end}T23:59:59`).order("publish_at",{ascending:true}),
      admin.from("efimero_fatigue_snapshots").select("score,snapshot,created_at").order("created_at",{ascending:false}).limit(1).maybeSingle(),
      admin.from("efimero_learning_profiles").select("profile,created_at").eq("page_id",pageId).eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      admin.from("efimero_editorial_dataset").select("text,category,hook,performance_score,length_bucket").eq("page_id",pageId).order("performance_score",{ascending:false}).limit(20),
    ]);
    const scheduled=scheduledQ.data||[];const counts=new Map<string,number>();for(const row of scheduled){const day=String(row.publish_at||"").slice(0,10);counts.set(day,(counts.get(day)||0)+1)}
    const timePool=["09:00","12:30","16:30","19:30","22:00","23:30"];
    const slots:Array<{date:string;time:string}>=[];
    for(let d=0;d<horizon&&slots.length<maxItems;d++){
      const date=addDays(start,d);const missing=Math.max(0,perDay-(counts.get(date)||0));
      for(let i=0;i<missing&&slots.length<maxItems;i++)slots.push({date,time:timePool[(counts.get(date)||0+i)%timePool.length]});
    }
    if(!slots.length)return NextResponse.json({ok:true,pageId,pageName,items:[],message:"El calendario ya cubre el horizonte seleccionado."});
    const fatigue=fatigueQ.data?.snapshot||{};const learning=learningQ.data?.profile||{};const examples=datasetQ.data||[];
    const key=process.env.OPENAI_API_KEY;let generated:any[]=[];
    if(key){
      const prompt=`Eres el agente editorial autónomo de Efímero. Debes proponer y redactar ${slots.length} textos NUEVOS para Facebook, uno por cada hueco de calendario.\nPágina: ${pageName}. Objetivo: ${objective}.\nHuecos exactos: ${slots.map((s,i)=>`${i+1}) ${s.date} ${s.time}`).join(" | ")}\nAprendizaje activo: ${JSON.stringify(learning).slice(0,4500)}\nFatiga reciente: ${JSON.stringify(fatigue).slice(0,2500)}\nMejores históricos del dataset:\n${examples.slice(0,12).map((x:any,i:number)=>`${i+1}. [${x.category}] ${x.text} | hook ${x.hook||"—"} | score ${x.performance_score||0}`).join("\n")}\n\nReglas: prioriza huecos y variedad de categorías; evita repetir hooks, metáforas o frases del histórico; no uses CTA para comentar, compartir, reaccionar, etiquetar o seguir; no engagement bait ni clickbait. Una pregunta orgánica es válida. El campo reason debe explicar brevemente POR QUÉ ese texto cubre una necesidad editorial, sin afirmar que será viral. Devuelve JSON.`;
      const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5-mini",input:prompt,text:{format:{type:"json_schema",name:"efimero_agent_plan",schema:{type:"object",additionalProperties:false,properties:{items:{type:"array",minItems:1,maxItems:8,items:{type:"object",additionalProperties:false,properties:{index:{type:"integer"},category:{type:"string"},text:{type:"string"},reason:{type:"string"}},required:["index","category","text","reason"]}}},required:["items"]}}}})});
      if(response.ok){const data=await response.json();const output=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;try{generated=JSON.parse(output||"{}").items||[]}catch{}}
    }
    if(!generated.length)generated=slots.map((_,i)=>({index:i+1,category:categoryFallback[i%categoryFallback.length],text:textFallback[i%textFallback.length],reason:"Cubre un hueco del calendario con una línea editorial distinta a la pieza anterior."}));
    const items:any[]=[];
    for(let i=0;i<slots.length;i++){
      const source=generated.find((x:any)=>Number(x.index)===i+1)||generated[i]||{};let text=String(source.text||textFallback[i%textFallback.length]).trim();let compliance=localComplianceReview(text);if(compliance.status!=="pass"){text=sanitizeEngagementBait(text);compliance=localComplianceReview(text)}
      const score=await evaluateEditorialText({text,category:String(source.category||categoryFallback[i%categoryFallback.length]),targetWords:Number(learning?.targetWords||learning?.avgWords||18),pageId});
      items.push({...slots[i],category:String(source.category||categoryFallback[i%categoryFallback.length]),text,reason:String(source.reason||"Cubre un hueco editorial detectado por el agente."),compliance,score});
    }
    const {data:run}=await admin.from("efimero_agent_runs").insert({owner_user_id:user.id,page_id:pageId,page_name:pageName,horizon_days:horizon,objective,calendar_context:{start,end,existing:scheduled.length,perDay},context:{fatigue,learning,datasetExamples:examples.length},plan:items}).select("id,created_at").single();
    return NextResponse.json({ok:true,runId:run?.id||null,createdAt:run?.created_at||new Date().toISOString(),pageId,pageName,start,end,existing:scheduled.length,items});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible ejecutar el agente editorial."},{status:500});}
}
