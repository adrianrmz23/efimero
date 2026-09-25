import { NextRequest, NextResponse } from "next/server";
import { localComplianceReview, sanitizeEngagementBait } from "@/lib/metaCompliance";

const fallbackIdeas=[
  "Hay cosas que uno entiende tarde, pero justo a tiempo para vivir distinto.",
  "Qué extraño cuando una pequeña costumbre termina diciendo mucho de una etapa de tu vida.",
  "A veces lo que más recordamos no era importante en ese momento.",
];

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const comments=Array.isArray(body.comments)?body.comments.map(String).filter(Boolean).slice(0,100):[];
  const apiKey=process.env.OPENAI_API_KEY;
  if(!comments.length)return NextResponse.json({error:"No hay comentarios para analizar."},{status:400});
  if(!apiKey){
    return NextResponse.json({source:"local",summary:"Hay conversación suficiente para extraer temas, pero falta OPENAI_API_KEY para una lectura semántica profunda.",themes:[{label:"Conversación general",signal:`${comments.length} comentarios disponibles`}],language:[],ideas:fallbackIdeas.map(text=>({text,category:"Frases identificables",reason:"Fallback local",theme:"Conversación",compliance:localComplianceReview(text)}))});
  }
  const model=process.env.OPENAI_MODEL||"gpt-5-mini";
  const sample=comments.map((x:string,i:number)=>`${i+1}. ${x}`).join("\n");
  const prompt=`Eres analista editorial de una página de Facebook. Analiza comentarios reales SIN identificar personas. Busca temas, vocabulario recurrente, preguntas y emociones útiles para crear NUEVOS textos. No copies comentarios literalmente ni reproduzcas frases distintivas. No conviertas el análisis en engagement bait.\n\nPágina: ${String(body.pageName||"")}\nPost original: ${String(body.postText||"")}\n\nComentarios:\n${sample}\n\nDevuelve un resumen breve, 3-6 temas, 4-8 expresiones o conceptos de lenguaje (parafraseados) y 3-6 ideas de publicaciones nuevas. Las ideas deben ser autosuficientes, naturales, sin pedir comentar, compartir, reaccionar, etiquetar o seguir.`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:prompt,text:{format:{type:"json_schema",name:"audience_voice",schema:{type:"object",additionalProperties:false,properties:{summary:{type:"string"},themes:{type:"array",minItems:1,maxItems:6,items:{type:"object",additionalProperties:false,properties:{label:{type:"string"},signal:{type:"string"}},required:["label","signal"]}},language:{type:"array",maxItems:8,items:{type:"string"}},ideas:{type:"array",minItems:1,maxItems:6,items:{type:"object",additionalProperties:false,properties:{text:{type:"string"},category:{type:"string"},reason:{type:"string"},theme:{type:"string"}},required:["text","category","reason","theme"]}}},required:["summary","themes","language","ideas"]}}}})});
  if(!response.ok)return NextResponse.json({error:"No fue posible analizar la voz de audiencia."},{status:502});
  const data=await response.json();const output=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
  try{const parsed=JSON.parse(output||"{}");const ideas=(parsed.ideas||[]).map((x:any)=>{const first=localComplianceReview(String(x.text||""));const text=first.status==="pass"?String(x.text||""):sanitizeEngagementBait(String(x.text||""));return {...x,text,compliance:localComplianceReview(text)}}).filter((x:any)=>x.text&&x.compliance.status!=="block");return NextResponse.json({...parsed,ideas,source:"openai"})}catch{return NextResponse.json({error:"La respuesta no pudo interpretarse."},{status:502})}
}
