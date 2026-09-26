import { NextRequest, NextResponse } from "next/server";

const categories=["Frases identificables","Humor","Relaciones","Nostalgia","Preguntas","Pensamientos nocturnos","Motivación ligera","Vida cotidiana","Otros"];

function normalize(text:string){return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function localAnalyze(text:string){
  const t=normalize(text);const words=text.trim().split(/\s+/).filter(Boolean).length;
  const category=/amor|pareja|querer|extrañ|corazon|relacion/.test(t)?"Relaciones":/recuerdo|antes|infancia|nostalgia|volver|epoca/.test(t)?"Nostalgia":/[¿?]/.test(text)?"Preguntas":/jaja|adult|trabajo|lunes|viernes|cafe|dinero/.test(t)?"Humor":"Frases identificables";
  const hook=text.trim().split(/\s+/).slice(0,6).join(" ").replace(/[.,!?¡¿:;]+$/g,"");
  const structure=[words<=14?"copy muy corto":words<=28?"copy corto":"copy medio",/[¿?]/.test(text)?"pregunta directa":"afirmación directa"].join(" · ");
  const theme=category==="Relaciones"?"vínculos y afecto":category==="Nostalgia"?"memoria y paso del tiempo":category==="Humor"?"cotidiano/humor":"identificación emocional";
  return {text,category,tone:category==="Humor"?"humorístico":category==="Nostalgia"?"nostálgico":"emocional/reflexivo",hook,structure,theme,mechanism:/[¿?]/.test(text)?"invita a recordar o responder mentalmente con una pregunta natural":"busca identificación mediante una afirmación fácil de reconocer",summary:"Análisis local basado en longitud, apertura y señales temáticas.",confidence:text?0.58:0};
}

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const text=String(body.text||"").trim().slice(0,4000);
  const imageDataUrl=String(body.imageDataUrl||"");
  if(!text&&!imageDataUrl)return NextResponse.json({error:"Pega un texto o sube una captura."},{status:400});
  if(imageDataUrl && (!imageDataUrl.startsWith("data:image/") || imageDataUrl.length>4_000_000))return NextResponse.json({error:"La captura no es válida o es demasiado grande."},{status:400});
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey){if(!text)return NextResponse.json({error:"Se necesita OPENAI_API_KEY para leer texto desde una captura."},{status:400});return NextResponse.json({source:"local",analysis:localAnalyze(text)});}
  const model=process.env.OPENAI_VISION_MODEL||process.env.OPENAI_MODEL||"gpt-5-mini";
  const content:any[]=[{type:"input_text",text:`Analiza una referencia editorial externa para una página de Facebook. El objetivo NO es copiarla: debes abstraer su patrón para inspirar textos nuevos.\n\nReglas:\n- Si hay una imagen, transcribe únicamente el copy principal visible. Ignora interfaz, botones, nombre de página y marcas de agua.\n- Si también llega texto pegado, úsalo como fuente prioritaria y la imagen como contexto.\n- category debe ser una de: ${categories.join(", ")}.\n- hook: describe o cita solo la apertura, máximo 8 palabras.\n- structure: describe la arquitectura del copy, no su contenido literal.\n- theme: tema general.\n- mechanism: mecanismo editorial/psicológico abstracto (identificación, contraste, nostalgia, pregunta fácil, remate cotidiano, etc.).\n- summary: por qué puede resultar atractivo sin afirmar que será viral.\n- No sugieras copiar frases distintivas.\n\nFuente: ${String(body.sourceName||"Referencia externa")}\nURL: ${String(body.sourceUrl||"")}\nTexto pegado: ${text||"(vacío; léelo de la captura)"}`}];
  if(imageDataUrl)content.push({type:"input_image",image_url:imageDataUrl});
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"user",content}],text:{format:{type:"json_schema",name:"inspiration_analysis",schema:{type:"object",additionalProperties:false,properties:{text:{type:"string"},category:{type:"string",enum:categories},tone:{type:"string"},hook:{type:"string"},structure:{type:"string"},theme:{type:"string"},mechanism:{type:"string"},summary:{type:"string"},confidence:{type:"number",minimum:0,maximum:1}},required:["text","category","tone","hook","structure","theme","mechanism","summary","confidence"]}}}})});
    if(!response.ok)throw new Error(await response.text());
    const data=await response.json();const output=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
    const analysis=JSON.parse(output||"{}");
    if(!String(analysis.text||"").trim()&&!text)return NextResponse.json({error:"No pude encontrar un copy legible en la captura."},{status:422});
    if(!analysis.text)analysis.text=text;
    return NextResponse.json({source:"openai",model,analysis});
  }catch(error:any){
    if(text)return NextResponse.json({source:"local-fallback",warning:"El análisis con IA falló; usé análisis local.",analysis:localAnalyze(text)});
    return NextResponse.json({error:"No fue posible analizar la captura.",detail:error?.message||"error"},{status:502});
  }
}
