import { NextRequest, NextResponse } from "next/server";
import { createEmbeddings, vectorLiteral } from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";

function normalize(text:string){return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function lexicalSimilarity(a:string,b:string){const A=new Set(normalize(a).split(" ").filter(Boolean)),B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;const i=[...A].filter(x=>B.has(x)).length;return i/new Set([...A,...B]).size}
function cosine(a:number[],b:number[]){let dot=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return aa&&bb?dot/(Math.sqrt(aa)*Math.sqrt(bb)):0}
function extractJson(text:string){const clean=String(text||"").replace(/```json/gi,"").replace(/```/g,"").trim();const start=clean.indexOf("{");const end=clean.lastIndexOf("}");if(start<0||end<start)return null;try{return JSON.parse(clean.slice(start,end+1))}catch{return null}}

type Variation={text:string;category:string;patternKept:string;changed:string};

async function cheaperInference(prompt:string,count:number){
  const apiKey=process.env.CHEAPERINFERENCE_API_KEY||process.env.CHEAPESTINFERENCE_API_KEY||process.env.CHEAPINFERENCE_API_KEY;
  if(!apiKey)return null;
  const model=process.env.CHEAPERINFERENCE_MODEL||process.env.CHEAPESTINFERENCE_MODEL||process.env.CHEAPINFERENCE_MODEL||"gpt-5.6-terra";
  const configured=process.env.CHEAPERINFERENCE_BASE_URL||process.env.CHEAPESTINFERENCE_BASE_URL||process.env.CHEAPINFERENCE_BASE_URL||"https://api.cheaperinference.com/v1";
  const base=configured.replace("api.cheapestinference.com","api.cheaperinference.com").replace(/\/$/,"");
  const response=await fetch(`${base}/chat/completions`,{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","X-CI-Concise":"1"},body:JSON.stringify({model,messages:[{role:"system",content:"Eres el Radar de Inspiración de Efímero. Generas textos originales y devuelves únicamente JSON válido, sin Markdown."},{role:"user",content:prompt}],max_tokens:Math.max(900,count*260)}),cache:"no-store"});
  if(!response.ok){const detail=await response.text();throw new Error(`Cheaper Inference respondió ${response.status}: ${detail.slice(0,320)}`)}
  const data=await response.json();const content=String(data?.choices?.[0]?.message?.content||"");const parsed=extractJson(content);
  const items=(Array.isArray(parsed?.items)?parsed.items:[]).slice(0,count).map((x:any)=>({text:String(x?.text||"").trim(),category:String(x?.category||"General"),patternKept:String(x?.patternKept||""),changed:String(x?.changed||"")})).filter((x:Variation)=>x.text);
  if(!items.length)throw new Error("Cheaper Inference respondió, pero no devolvió el JSON de variaciones esperado.");
  return {source:"cheaperinference",model,items};
}

async function openAI(prompt:string,count:number){
  const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return null;
  const model=process.env.OPENAI_MODEL||"gpt-5.6-luna";
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:prompt,text:{format:{type:"json_schema",name:"inspiration_variations",schema:{type:"object",additionalProperties:false,properties:{items:{type:"array",minItems:1,maxItems:12,items:{type:"object",additionalProperties:false,properties:{text:{type:"string"},category:{type:"string"},patternKept:{type:"string"},changed:{type:"string"}},required:["text","category","patternKept","changed"]}}},required:["items"]}}}})});
  if(!response.ok){const detail=await response.text();throw new Error(`OpenAI respondió ${response.status}: ${detail.slice(0,320)}`)}
  const data=await response.json();const output=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;const parsed=extractJson(output||"");
  const items=(Array.isArray(parsed?.items)?parsed.items:[]).slice(0,count).map((x:any)=>({text:String(x?.text||"").trim(),category:String(x?.category||"General"),patternKept:String(x?.patternKept||""),changed:String(x?.changed||"")})).filter((x:Variation)=>x.text);
  if(!items.length)throw new Error("OpenAI respondió, pero no devolvió variaciones utilizables.");
  return {source:"openai",model,items};
}

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const reference=body.reference&&typeof body.reference==="object"?body.reference:{};
  const sourceText=String(reference.text||"").trim();
  if(!sourceText)return NextResponse.json({error:"Falta el texto de referencia."},{status:400});
  const count=Math.max(1,Math.min(12,Number(body.count||6)));
  const mode=String(body.mode||"pattern-new-theme");
  const modeInstruction=mode==="same-theme-new-structure"?"Conserva el tema general, pero cambia por completo la estructura, apertura y formulación.":mode==="mechanism-only"?"Conserva únicamente el mecanismo editorial abstracto; cambia tema, imágenes mentales, vocabulario y estructura superficial.":"Conserva la arquitectura/patrón editorial, pero cambia completamente el tema y la formulación.";
  const prompt=`Crea ${count} textos NUEVOS para Facebook a partir de un patrón externo, nunca como paráfrasis.\n\nREFERENCIA EXTERNA:\n${sourceText}\nCategoría: ${String(reference.category||"Otros")}\nTono: ${String(reference.tone||"")}\nHook/patrón de apertura: ${String(reference.hook||"")}\nEstructura: ${String(reference.structure||"")}\nTema: ${String(reference.theme||"")}\nMecanismo: ${String(reference.mechanism||"")}\n\nMODO: ${modeInstruction}\n\nREGLAS OBLIGATORIAS:\n- No copies frases distintivas, metáforas, secuencias de palabras ni remates de la referencia.\n- Cada salida debe ser sustancialmente distinta de la referencia y de las demás salidas.\n- Español natural de México.\n- No uses llamadas directas a comentar, compartir, reaccionar, dar like, etiquetar o seguir.\n- No engagement bait, clickbait ni incentivos artificiales.\n- Una pregunta natural sí puede existir si funciona como contenido por sí misma.\n- No afirmes que un texto será viral.\n\nDevuelve SOLO JSON válido con esta forma exacta:\n{"items":[{"text":"...","category":"...","patternKept":"...","changed":"..."}]}`;
  const providerErrors:string[]=[];let generated:any=null;
  try{generated=await cheaperInference(prompt,count)}catch(error:any){providerErrors.push(error?.message||"Falló Cheaper Inference.")}
  if(!generated?.items?.length){try{generated=await openAI(prompt,count)}catch(error:any){providerErrors.push(error?.message||"Falló OpenAI.")}}
  if(!generated?.items?.length)return NextResponse.json({error:"No hay un proveedor de IA disponible para generar variaciones.",details:providerErrors.slice(0,3)},{status:502});

  let items=(generated.items as Variation[]).slice(0,count);
  let embeddings:number[][]=[];try{embeddings=await createEmbeddings([sourceText,...items.map(x=>x.text)])}catch{}
  const sourceEmbedding=embeddings[0]||[];const admin=(()=>{try{return getSupabaseAdmin()}catch{return null}})();const enriched=[] as any[];
  for(let i=0;i<items.length;i++){
    const raw=items[i];let text=raw.text;let compliance=localComplianceReview(text);if(compliance.status!=="pass"){text=sanitizeEngagementBait(text);compliance=localComplianceReview(text)}
    const lexical=lexicalSimilarity(sourceText,text);const semantic=sourceEmbedding.length&&embeddings[i+1]?.length?cosine(sourceEmbedding,embeddings[i+1]):0;let datasetSimilarity=0;let nearest:any[]=[];
    if(admin&&embeddings[i+1]?.length){try{const {data:near}=await admin.rpc("match_efimero_dataset",{query_embedding:vectorLiteral(embeddings[i+1]),match_count:3,filter_category:null});nearest=near||[];datasetSimilarity=Math.max(0,...nearest.map((x:any)=>Number(x.similarity||0)))}catch{}}
    const maxSimilarity=Math.max(lexical,semantic,datasetSimilarity);const novelty=Math.max(0,Math.min(100,Math.round((1-maxSimilarity)*100)));enriched.push({...raw,text,compliance,novelty,maxSimilarity:Number(maxSimilarity.toFixed(3)),sourceSimilarity:Number(Math.max(lexical,semantic).toFixed(3)),datasetSimilarity:Number(datasetSimilarity.toFixed(3)),nearest:nearest.slice(0,3)});
  }
  return NextResponse.json({source:generated.source,model:generated.model,items:enriched,warning:providerErrors.length?providerErrors.join(" · "):undefined});
}
