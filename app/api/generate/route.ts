import { NextRequest, NextResponse } from "next/server";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const fallback = [
  "¿Qué comida podrías repetir toda la semana sin cansarte?",
  "¿Qué te dijo tu mamá cuando vio algo tuyo que no esperaba?",
  "¿Qué compra pequeña terminó siendo mucho más útil de lo que imaginabas?",
  "Sin calcular demasiado: 10 × 10 − 2 + 13 = ?",
  "¿Qué hábito de adulto jurabas que nunca ibas a tener?",
  "¿Qué lugar de tu infancia recuerdas con más detalle de lo normal?",
];

const QUESTION_THEMES = [
  "vida cotidiana y hábitos",
  "familia e infancia",
  "comida y antojos",
  "amistades y relaciones cotidianas",
  "trabajo, escuela o vida adulta",
  "decisiones y preferencias personales",
  "humor y situaciones incómodas",
  "recuerdos de lugares y etapas",
  "compras, objetos y pequeñas manías",
  "tecnología, internet y costumbres digitales",
  "viajes, lugares y planes",
  "hobbies, juegos y tiempo libre",
  "tradiciones, fines de semana y celebraciones",
  "retos mentales o elecciones rápidas",
  "música y entretenimiento",
] as const;

function questionThemeFor(recentTexts:string[]){
  const recent=recentTexts.join(" ").toLowerCase();
  const musicHeavy=/canci[oó]n|m[uú]sica|artista|playlist|concierto/.test(recent);
  const usable=musicHeavy?QUESTION_THEMES.filter(x=>!x.startsWith("música")):QUESTION_THEMES;
  return usable[recentTexts.length%usable.length]||QUESTION_THEMES[0];
}

function extractJson(text:string){
  const clean=String(text||"").replace(/```json/gi,"").replace(/```/g,"").trim();
  const start=clean.indexOf("{");const end=clean.lastIndexOf("}");
  if(start<0||end<start)return null;
  try{return JSON.parse(clean.slice(start,end+1))}catch{return null}
}

async function getLearningPatterns(category:string){
  try{
    const user=await getServerUser();if(!user)return [] as any[];
    const admin=getSupabaseAdmin();
    const {data}=await admin.from("efimero_learning_patterns").select("title,category,tone,hook_type,structure,theme,mechanism,sample_size,avg_engagement_score").eq("owner_user_id",user.id).order("avg_engagement_score",{ascending:false}).order("sample_size",{ascending:false}).limit(10);
    const rows=data||[];
    const matching=rows.filter((x:any)=>String(x.category||"").toLowerCase().includes(category.toLowerCase())||category.toLowerCase().includes(String(x.category||"").toLowerCase()));
    return (matching.length?matching:rows).slice(0,6);
  }catch{return [] as any[]}
}

async function cheaperInference(prompt:string,count:number){
  const apiKey=process.env.CHEAPERINFERENCE_API_KEY||process.env.CHEAPESTINFERENCE_API_KEY||process.env.CHEAPINFERENCE_API_KEY;
  if(!apiKey)return null;
  const model=process.env.CHEAPERINFERENCE_MODEL||process.env.CHEAPESTINFERENCE_MODEL||process.env.CHEAPINFERENCE_MODEL||"gpt-5.6-terra";
  const configured=process.env.CHEAPERINFERENCE_BASE_URL||process.env.CHEAPESTINFERENCE_BASE_URL||process.env.CHEAPINFERENCE_BASE_URL||"https://api.cheaperinference.com/v1";
  // Versiones anteriores de Efímero documentaron por error "cheapestinference".
  // Si ese valor sigue guardado en Vercel, lo corregimos automáticamente.
  const base=configured.replace("api.cheapestinference.com","api.cheaperinference.com").replace(/\/$/,"");
  const response=await fetch(`${base}/chat/completions`,{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","X-CI-Concise":"1"},
    body:JSON.stringify({model,messages:[{role:"system",content:"Eres un redactor senior de Facebook especializado en copies breves, naturales y memorables. Devuelves JSON válido sin Markdown."},{role:"user",content:prompt}],max_tokens:Math.max(450,count*160)}),
    cache:"no-store",
  });
  if(!response.ok){const detail=await response.text();throw new Error(`Cheaper Inference respondió ${response.status}: ${detail.slice(0,260)}`)}
  const data=await response.json();const content=data?.choices?.[0]?.message?.content||"";const parsed=extractJson(content);
  const items=Array.isArray(parsed?.items)?parsed.items.map((x:any)=>typeof x==="string"?x:String(x?.text||"")).filter(Boolean).slice(0,count):[];
  if(!items.length)throw new Error("Cheaper Inference respondió, pero no devolvió el JSON de publicaciones esperado.");
  return {items,model,source:"cheaperinference"};
}

async function openAI(prompt:string,count:number){
  const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return null;
  const model=process.env.OPENAI_MODEL||"gpt-5.6-luna";
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({model,input:prompt,text:{format:{type:"json_schema",name:"efimero_posts",schema:{type:"object",additionalProperties:false,properties:{items:{type:"array",items:{type:"string"},minItems:1,maxItems:30}},required:["items"]}}}}),
  });
  if(!response.ok)return null;
  const data=await response.json();const outputText=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;const parsed=extractJson(outputText||"{}");
  return {items:Array.isArray(parsed?.items)?parsed.items.filter((x:unknown)=>typeof x==="string").slice(0,count):[],model,source:"openai"};
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const category = String(body.category || "Frases identificables");
  const count = Math.min(Math.max(Number(body.count || 5), 1), 30);
  const examples = Array.isArray(body.examples) ? body.examples.slice(0, 12).map(String) : [];
  const profile = body.profile && typeof body.profile === "object" ? body.profile : null;
  const mode=String(body.mode||"calendar");
  const interactionStyle=String(body.interactionStyle||"Mixto");
  const objective=String(body.objective||"Generar identificación y conversación natural.");
  const recentTexts=Array.isArray(body.recentTexts)?body.recentTexts.slice(-10).map(String).filter(Boolean):[];
  const questionTheme=category.toLowerCase().includes("pregunta")?questionThemeFor(recentTexts):"";
  const patterns=await getLearningPatterns(category);
  const profileContext = profile
    ? `\nHuella editorial propia:\n- ${String(profile.generationInstruction || "")}\n- Promedio: ${Number(profile.avgWords || 0)} palabras.\n- Reglas: ${(Array.isArray(profile.rules) ? profile.rules : []).join(" | ")}\n- Evitar: ${(Array.isArray(profile.avoid) ? profile.avoid : []).join(" | ")}`
    : "";
  const patternContext=patterns.length?`\nPatrones abstractos aprendidos de referencias externas (usa mecanismos, NO copies frases):\n${patterns.map((p:any)=>`- ${p.title}: hook ${p.hook_type||""}; estructura ${p.structure||""}; tema ${p.theme||""}; mecanismo ${p.mechanism||""}; tono ${p.tone||""}; señal ${Math.round(Number(p.avg_engagement_score||0))}/100`).join("\n")}`:"";
  const recentContext=recentTexts.length?`\nÚLTIMAS SALIDAS DE ESTA SESIÓN (NO repitas tema, objeto, pregunta ni estructura):\n${recentTexts.map((x:string)=>`- ${x}`).join("\n")}`:"";
  const themeBatch=category.toLowerCase().includes("pregunta")?QUESTION_THEMES.slice(0,Math.min(Math.max(count,6),QUESTION_THEMES.length)):[];
  const questionDiversity=questionTheme?`\nREGLA ESPECIAL PARA PREGUNTAS:\n- Tema OBLIGATORIO de esta generación: ${questionTheme}.\n- No uses canciones, música, artistas, playlists o conciertos salvo que el tema obligatorio sea música y entretenimiento.\n- Formula una pregunta concreta, fácil de entender y diferente a las últimas salidas.\n- Alterna entre recuerdo, preferencia, experiencia, dilema, humor, hábito o elección rápida según el tema.`:themeBatch.length?`\nREGLA ESPECIAL PARA PREGUNTAS EN LOTE:\n- Reparte las salidas entre temas DISTINTOS. Usa esta lista como rotación: ${themeBatch.join(" | ")}.\n- No repitas el mismo asunto en dos publicaciones consecutivas.\n- Música/entretenimiento puede aparecer como máximo en una pieza del lote.\n- Alterna tipos de pregunta: recuerdo, preferencia, experiencia, dilema, humor, hábito y elección rápida.`:"";
  const quickRules=mode==="quick"?`\nMODO RÁPIDO DE INTERACCIÓN NATURAL:\n- Tipo solicitado: ${interactionStyle}.\n- Objetivo: ${objective}.\n- Prioriza 8 a 28 palabras. Una sola idea por publicación.\n- Debe entenderse en menos de 2 segundos.\n- Usa preguntas personales concretas, humor identificable, nostalgia, dilemas o retos ligeros cuando corresponda.\n- Evita frases motivacionales genéricas y explicaciones largas.\n- Una pregunta natural es válida; NO ordenes interactuar.${questionDiversity}${recentContext}`:`\nPrioriza copies breves, concretos y variados; evita relleno.${questionDiversity}`;
  const prompt = `Crea ${count} publicaciones NUEVAS en español para Facebook, categoría "${category}".${quickRules}${profileContext}${patternContext}

Ejemplos propios útiles (solo para captar tono; no copies):
${examples.map((x:string)=>`- ${x}`).join("\n")||"- Sin ejemplos disponibles."}

Reglas obligatorias:
- No uses: "comenta", "comparte", "dale like", "reacciona", "etiqueta", "síguenos", "escribe AMÉN", "dinos", ni equivalentes imperativos de engagement bait.
- No prometas premios ni uses clickbait.
- Evita hashtags salvo que sean esenciales.
- No parafrasees literalmente un ejemplo ni un patrón externo.
- Busca una reacción mental espontánea: recordar, elegir, reír, identificarse o responder naturalmente.
- Diversifica aperturas y estructuras.

Devuelve SOLO JSON válido: {"items":["texto 1","texto 2"]}.`;

  const providerErrors:string[]=[];
  let generated:any=null;
  try{generated=await cheaperInference(prompt,count)}catch(error:any){providerErrors.push(error?.message||"Falló Cheaper Inference.")}
  if(!generated?.items?.length){
    try{generated=await openAI(prompt,count)}catch(error:any){providerErrors.push(error?.message||"Falló OpenAI.")}
  }
  if(!generated?.items?.length){
    const allowLocal=String(process.env.ALLOW_LOCAL_GENERATION_FALLBACK||"").toLowerCase()==="true";
    if(!allowLocal){
      return NextResponse.json({error:"No hay un proveedor de IA disponible para generar esta publicación.",details:providerErrors.slice(0,3),source:"none"},{status:502});
    }
    generated={items:fallback.slice(0,count),model:"local",source:"fallback"};
  }
  const compliant:string[]=[];
  for(const text of generated.items){
    const value=String(text||"").trim();if(!value)continue;
    const first=localComplianceReview(value);
    if(first.status==="pass"){compliant.push(value);continue}
    const cleaned=sanitizeEngagementBait(value);if(localComplianceReview(cleaned).status==="pass"&&cleaned.trim())compliant.push(cleaned.trim());
  }
  if(!compliant.length){return NextResponse.json({error:"La IA respondió, pero todos los textos fueron bloqueados por Compliance.",source:generated.source,model:generated.model},{status:422})}
  return NextResponse.json({source:generated.source,model:generated.model,items:compliant.slice(0,count),complianceChecked:true,patternsUsed:patterns.length,warning:providerErrors.length?providerErrors.join(" · "):undefined});
}
