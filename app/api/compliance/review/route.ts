import { NextRequest, NextResponse } from "next/server";
import { localComplianceReview, META_RULES, META_RULESET_VERSION, sanitizeEngagementBait } from "@/lib/metaCompliance";

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const texts:string[]=(Array.isArray(body.texts)?body.texts:[body.text]).map((x:any)=>String(x||"").trim()).filter(Boolean).slice(0,40);
  if(!texts.length)return NextResponse.json({error:"No llegaron textos para revisar."},{status:400});
  const local=texts.map(text=>({text,...localComplianceReview(text)}));
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({source:"local",rulesetVersion:META_RULESET_VERSION,items:local});

  const model=process.env.OPENAI_MODEL||"gpt-5-mini";
  const prompt=`Actúas como revisor conservador de cumplimiento editorial para publicaciones orgánicas monetizables en Facebook/Meta.\nReglas internas vigentes (${META_RULESET_VERSION}):\n- ${META_RULES.join("\n- ")}\n\nObjetivo especial: NO permitir llamados directos a comentar, compartir, reaccionar, etiquetar, seguir la página ni cualquier engagement bait. Una pregunta natural puede ser válida si no ordena al usuario interactuar.\n\nRevisa cada texto. status debe ser pass, review o block. score 0-100 representa cumplimiento editorial, NO probabilidad de monetización. correctedText debe mantener el sentido y eliminar cualquier riesgo que pueda corregirse sin inventar hechos. Si existe un posible problema de categorías sensibles, propiedad intelectual, afirmaciones médicas/financieras o normas comunitarias, marca review o block. No prometas que Meta monetizará el contenido.\n\nTEXTOS:\n${texts.map((t,i)=>`${i+1}. ${t}`).join("\n")}`;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:prompt,text:{format:{type:"json_schema",name:"meta_compliance",schema:{type:"object",additionalProperties:false,properties:{items:{type:"array",items:{type:"object",additionalProperties:false,properties:{index:{type:"integer"},status:{type:"string",enum:["pass","review","block"]},score:{type:"number"},issues:{type:"array",items:{type:"object",additionalProperties:false,properties:{code:{type:"string"},severity:{type:"string",enum:["low","medium","high"]},message:{type:"string"}},required:["code","severity","message"]}},correctedText:{type:"string"}},required:["index","status","score","issues","correctedText"]}}},required:["items"]}}}})});
    if(!response.ok)throw new Error(await response.text());
    const data=await response.json();
    const output=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
    const parsed=JSON.parse(output||"{}");
    const byIndex=new Map((parsed.items||[]).map((x:any)=>[Number(x.index),x]));
    const items=local.map((base,i)=>{
      const ai:any=byIndex.get(i+1)||{};
      const localBlocked=base.status==="block";
      const corrected=String(ai.correctedText||sanitizeEngagementBait(base.text)||base.text).trim();
      const aiIssues=Array.isArray(ai.issues)?ai.issues:[];
      const issues=[...base.issues,...aiIssues.filter((x:any)=>!base.issues.some(y=>y.code===x.code))];
      const aiStatus=ai.status||"pass";
      const status=localBlocked?"block":(base.status==="review"||aiStatus==="review"?"review":aiStatus);
      return {...base,status,score:Math.min(base.score,Number(ai.score??100)),issues,correctedText:corrected,rulesetVersion:META_RULESET_VERSION,rulesChecked:META_RULES,reviewedAt:new Date().toISOString()};
    });
    return NextResponse.json({source:"openai+local",model,rulesetVersion:META_RULESET_VERSION,items});
  }catch{
    return NextResponse.json({source:"local-fallback",rulesetVersion:META_RULESET_VERSION,items:local});
  }
}
