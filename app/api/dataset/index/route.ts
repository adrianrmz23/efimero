import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbeddings, vectorLiteral } from "@/lib/embeddings";

function hook(text:string){return text.trim().split(/\s+/).slice(0,4).join(" ").replace(/[.,!?¡¿:;]+$/g,"");}
function lengthBucket(words:number){return words<=10?"micro":words<=22?"corto":words<=40?"medio":"largo";}
function topicKey(category:string,text:string){const t=text.toLowerCase();if(/amor|pareja|relaci|querer|cariñ/.test(t))return "relaciones";if(/recuerdo|antes|infancia|nostalg|canción/.test(t))return "nostalgia";if(/trabajo|adult|dinero|lunes|café/.test(t))return "cotidiano";return category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"general";}

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const limit=Math.max(20,Math.min(300,Number(body.limit||150)));
  try{
    const admin=getSupabaseAdmin();
    const {data,error}=await admin.from("efimero_content_library").select("id,text,category,source_page_id,source_page_name,reactions,comments,shares,performance_score,published_at,source").neq("text","").order("performance_score",{ascending:false}).limit(limit);
    if(error)throw error;
    const rows=(data||[]).filter((x:any)=>String(x.text||"").trim().length>=8);
    let indexed=0;
    for(let i=0;i<rows.length;i+=80){
      const chunk=rows.slice(i,i+80);const vectors=await createEmbeddings(chunk.map((x:any)=>String(x.text)));
      const payload=chunk.map((x:any,j:number)=>{const words=String(x.text).trim().split(/\s+/).length;const performance=Number(x.performance_score||0);return {content_library_id:x.id,text:x.text,category:x.category,page_id:x.source_page_id||null,page_name:x.source_page_name||null,hook:hook(String(x.text)),topic_key:topicKey(String(x.category||"General"),String(x.text)),length_bucket:lengthBucket(words),word_count:words,performance_score:performance,evergreen_score:Math.min(100,Math.round((performance*1.6)+(Number(x.shares||0)>0?18:0)+(x.source==="historical"?12:0))),fatigue_risk:0,embedding:vectorLiteral(vectors[j]),indexed_at:new Date().toISOString()}});
      const {error:upsertError}=await admin.from("efimero_editorial_dataset").upsert(payload,{onConflict:"content_library_id"});if(upsertError)throw upsertError;indexed+=payload.length;
    }
    return NextResponse.json({ok:true,indexed,model:process.env.OPENAI_EMBEDDING_MODEL||"text-embedding-3-small",indexedAt:new Date().toISOString()});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible indexar el dataset."},{status:500});}
}
