import { NextRequest, NextResponse } from "next/server";
import { createEmbeddings, vectorLiteral } from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";

function normalize(text:string){return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function lexicalSimilarity(a:string,b:string){const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;const i=[...A].filter(x=>B.has(x)).length;return i/new Set([...A,...B]).size}
function cosine(a:number[],b:number[]){let dot=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return aa&&bb?dot/(Math.sqrt(aa)*Math.sqrt(bb)):0}

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const reference=body.reference&&typeof body.reference==="object"?body.reference:{};
  const sourceText=String(reference.text||"").trim();
  if(!sourceText)return NextResponse.json({error:"Falta el texto de referencia."},{status:400});
  const count=Math.max(1,Math.min(12,Number(body.count||6)));
  const mode=String(body.mode||"pattern-new-theme");
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({error:"Falta OPENAI_API_KEY para generar variaciones."},{status:500});
  const model=process.env.OPENAI_MODEL||"gpt-5-mini";
  const modeInstruction=mode==="same-theme-new-structure"?"Conserva el tema general, pero cambia por completo la estructura, apertura y formulación.":mode==="mechanism-only"?"Conserva únicamente el mecanismo editorial abstracto; cambia tema, imágenes mentales, vocabulario y estructura superficial.":"Conserva la arquitectura/patrón editorial, pero cambia completamente el tema y la formulación.";
  const prompt=`Eres el Radar de Inspiración de Efímero. Crea ${count} textos NUEVOS para Facebook a partir de un patrón externo, nunca como paráfrasis.\n\nREFERENCIA EXTERNA:\n${sourceText}\nCategoría: ${String(reference.category||"Otros")}\nTono: ${String(reference.tone||"")}\nHook/patrón de apertura: ${String(reference.hook||"")}\nEstructura: ${String(reference.structure||"")}\nTema: ${String(reference.theme||"")}\nMecanismo: ${String(reference.mechanism||"")}\n\nMODO: ${modeInstruction}\n\nREGLAS OBLIGATORIAS:\n- No copies frases distintivas, metáforas, secuencias de palabras ni remates de la referencia.\n- Cada salida debe ser sustancialmente distinta de la referencia y de las demás salidas.\n- Español natural de México.\n- No uses llamadas directas a comentar, compartir, reaccionar, dar like, etiquetar o seguir.\n- No engagement bait, clickbait ni incentivos artificiales.\n- Una pregunta natural sí puede existir si funciona como contenido por sí misma.\n- No afirmes que un texto será viral.\n\nPara cada salida explica en una frase qué patrón conservó y qué cambió.`;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:prompt,text:{format:{type:"json_schema",name:"inspiration_variations",schema:{type:"object",additionalProperties:false,properties:{items:{type:"array",minItems:1,maxItems:12,items:{type:"object",additionalProperties:false,properties:{text:{type:"string"},category:{type:"string"},patternKept:{type:"string"},changed:{type:"string"}},required:["text","category","patternKept","changed"]}}},required:["items"]}}}})});
    if(!response.ok)throw new Error(await response.text());
    const data=await response.json();const output=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;const parsed=JSON.parse(output||"{}");
    let items=(Array.isArray(parsed.items)?parsed.items:[]).slice(0,count).map((x:any)=>({text:String(x.text||"").trim(),category:String(x.category||reference.category||"General"),patternKept:String(x.patternKept||""),changed:String(x.changed||"")})).filter((x:any)=>x.text);
    let embeddings:number[][]=[];
    try{embeddings=await createEmbeddings([sourceText,...items.map((x:any)=>x.text)]);}catch{}
    const sourceEmbedding=embeddings[0]||[];
    const admin=(()=>{try{return getSupabaseAdmin()}catch{return null}})();
    const enriched=[] as any[];
    for(let i=0;i<items.length;i++){
      const raw=items[i];let text=raw.text;let compliance=localComplianceReview(text);if(compliance.status!=="pass"){text=sanitizeEngagementBait(text);compliance=localComplianceReview(text)}
      const lexical=lexicalSimilarity(sourceText,text);const semantic=sourceEmbedding.length&&embeddings[i+1]?.length?cosine(sourceEmbedding,embeddings[i+1]):0;
      let datasetSimilarity=0;let nearest:any[]=[];
      if(admin&&embeddings[i+1]?.length){try{const {data:near}=await admin.rpc("match_efimero_dataset",{query_embedding:vectorLiteral(embeddings[i+1]),match_count:3,filter_category:null});nearest=near||[];datasetSimilarity=Math.max(0,...nearest.map((x:any)=>Number(x.similarity||0)))}catch{}}
      const maxSimilarity=Math.max(lexical,semantic,datasetSimilarity);const novelty=Math.max(0,Math.min(100,Math.round((1-maxSimilarity)*100)));
      enriched.push({...raw,text,compliance,novelty,maxSimilarity:Number(maxSimilarity.toFixed(3)),sourceSimilarity:Number(Math.max(lexical,semantic).toFixed(3)),datasetSimilarity:Number(datasetSimilarity.toFixed(3)),nearest:nearest.slice(0,3)});
    }
    return NextResponse.json({source:"openai",model,items:enriched});
  }catch(error:any){return NextResponse.json({error:"No fue posible generar variaciones.",detail:error?.message||"error"},{status:502})}
}
