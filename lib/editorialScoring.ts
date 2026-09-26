import { createEmbeddings, vectorLiteral } from "@/lib/embeddings";
import { localComplianceReview } from "@/lib/metaCompliance";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type EditorialScoreBreakdown = {
  compliance:number;
  novelty:number;
  historicalAlignment:number;
  historicalSignal:number;
  lengthFit:number;
  fatigueSafety:number;
};

export type EditorialScoreResult = {
  score:number;
  breakdown:EditorialScoreBreakdown;
  verdict:"strong"|"promising"|"review"|"weak";
  reasons:string[];
  warnings:string[];
  nearest:Array<{text:string;category:string;similarity:number;performanceScore:number;lexicalSimilarity:number}>;
  compliance:ReturnType<typeof localComplianceReview>;
  wordCount:number;
};

const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
const normalize=(value:string)=>String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
const words=(value:string)=>normalize(value).split(" ").filter(Boolean);
const lexicalSimilarity=(a:string,b:string)=>{const A=new Set(words(a));const B=new Set(words(b));if(!A.size||!B.size)return 0;const intersection=[...A].filter(x=>B.has(x)).length;return intersection/new Set([...A,...B]).size};

export async function evaluateEditorialText(input:{text:string;category?:string;targetWords?:number;pageId?:string|null}):Promise<EditorialScoreResult>{
  const text=String(input.text||"").trim();
  const category=String(input.category||"").trim();
  const compliance=localComplianceReview(text);
  const wordCount=words(text).length;
  let rawHits:any[]=[];
  try{
    const admin=getSupabaseAdmin();
    const [embedding]=await createEmbeddings([`Categoría ${category||"general"}. ${text}`]);
    const {data,error}=await admin.rpc("match_efimero_dataset",{query_embedding:vectorLiteral(embedding),match_count:12,filter_category:category||null});
    if(error)throw error;
    rawHits=(data||[]).filter((x:any)=>!input.pageId||!x.page_id||String(x.page_id)===String(input.pageId));
  }catch{}

  const nearest=rawHits.slice(0,8).map((x:any)=>({
    text:String(x.text||""),
    category:String(x.category||"General"),
    similarity:Number(x.similarity||0),
    performanceScore:Number(x.performance_score||0),
    lexicalSimilarity:lexicalSimilarity(text,String(x.text||"")),
  }));
  const topSemantic=nearest.length?nearest[0].similarity:0;
  const avgSemantic=nearest.length?nearest.slice(0,5).reduce((n,x)=>n+x.similarity,0)/Math.min(5,nearest.length):0.5;
  const maxLex=nearest.length?Math.max(...nearest.map(x=>x.lexicalSimilarity)):0;
  const nearCopyCount=nearest.filter(x=>x.lexicalSimilarity>=.58).length;
  const perfValues=nearest.map(x=>Math.max(0,x.performanceScore));
  const perfMax=Math.max(1,...perfValues);
  const perfAvg=perfValues.length?perfValues.slice(0,5).reduce((a,b)=>a+b,0)/Math.min(5,perfValues.length):0;
  const targetWords=Math.max(6,Number(input.targetWords||18));

  const breakdown:EditorialScoreBreakdown={
    compliance:clamp(compliance.score),
    novelty:clamp(100-maxLex*110),
    historicalAlignment:clamp(avgSemantic*100),
    historicalSignal:nearest.length?clamp((perfAvg/perfMax)*100):55,
    lengthFit:clamp(100-Math.abs(wordCount-targetWords)*4.5),
    fatigueSafety:clamp(100-nearCopyCount*18-(topSemantic>.94?12:0)),
  };
  let score=Math.round(
    breakdown.compliance*.28+
    breakdown.novelty*.2+
    breakdown.historicalAlignment*.18+
    breakdown.historicalSignal*.12+
    breakdown.lengthFit*.1+
    breakdown.fatigueSafety*.12
  );
  if(compliance.status==="block")score=Math.min(score,38);
  if(compliance.status==="review")score=Math.min(score,68);
  if(maxLex>=.82)score=Math.min(score,62);
  const reasons:string[]=[];const warnings:string[]=[];
  if(breakdown.novelty>=80)reasons.push("El copy se diferencia bien de los históricos más cercanos.");
  if(breakdown.historicalAlignment>=70)reasons.push("La idea conserva señales semánticas presentes en el histórico editorial.");
  if(breakdown.lengthFit>=82)reasons.push(`La longitud (${wordCount} palabras) está cerca del rango editorial de referencia.`);
  if(breakdown.historicalSignal>=70&&nearest.length)reasons.push("Los ejemplos semánticamente cercanos tienen una señal histórica favorable dentro del dataset.");
  if(compliance.status==="pass")reasons.push("Compliance local no detectó engagement bait ni CTA artificial.");
  if(maxLex>=.58)warnings.push("Existe similitud léxica relevante con al menos un histórico; conviene revisar originalidad.");
  if(breakdown.fatigueSafety<65)warnings.push("El patrón aparece cerca de textos existentes y puede contribuir a fatiga editorial.");
  if(compliance.status!=="pass")warnings.push(`Compliance requiere ${compliance.status==="block"?"bloqueo":"revisión"} antes de publicar.`);
  if(wordCount>45)warnings.push("El texto es largo frente al formato habitual de Efímero.");
  if(!nearest.length)warnings.push("Aún hay poca memoria vectorial para comparar esta idea con históricos.");
  const verdict:EditorialScoreResult["verdict"]=score>=82?"strong":score>=70?"promising":score>=55?"review":"weak";
  return {score,breakdown,verdict,reasons,warnings,nearest,compliance,wordCount};
}
