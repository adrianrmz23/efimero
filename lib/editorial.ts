// Tipos y utilidades editoriales compartidas por la app (biblioteca, huella, generadores).
export type Category = { id:string; name:string; emoji:string; enabled:boolean };
export type LibrarySource = "manual"|"historical"|"generated"|"reference";
export type LibraryFilter = "all"|"generated"|"historical"|"reference"|"favorites"|"top";
export type LibraryItem = {
  id:string; text:string; category:string; format:string; createdAt:string; source?:LibrarySource;
  sourceUrl?:string; notes?:string; reactions?:number; comments?:number; shares?:number; reach?:number;
  publishedAt?:string; performanceScore?:number; favorite?:boolean; generationBatch?:string;
  platform?:"facebook"|string; platformPostId?:string; sourcePageId?:string; sourcePageName?:string;
  sourceImageUrl?:string; extractionMetadata?:Record<string,unknown>; factoryScore?:number; pageId?:string;
};
export type ProfileCategory = { name:string; count:number; share:number };
export type ToneScores = { reflective:number; conversational:number; humorous:number; emotional:number };
export type EditorialProfile = {
  sampleSize:number;
  avgChars:number;
  avgWords:number;
  questionRate:number;
  emojiRate:number;
  exclamationRate:number;
  shortRate:number;
  topCategories:ProfileCategory[];
  topWords:string[];
  hooks:string[];
  tone:ToneScores;
  summary:string;
  rules:string[];
  avoid:string[];
  generationInstruction:string;
  analyzedAt:string;
};

export const initialCategories: Category[] = [
  { id:"identificables", name:"Frases identificables", emoji:"💭", enabled:true },
  { id:"humor", name:"Humor", emoji:"😂", enabled:true },
  { id:"relaciones", name:"Relaciones", emoji:"❤️", enabled:true },
  { id:"nostalgia", name:"Nostalgia", emoji:"📼", enabled:true },
  { id:"preguntas", name:"Preguntas", emoji:"👀", enabled:true },
  { id:"noche", name:"Pensamientos nocturnos", emoji:"🌙", enabled:true },
  { id:"motivacion", name:"Motivación ligera", emoji:"✨", enabled:true },
  { id:"cotidiano", name:"Vida cotidiana", emoji:"☕", enabled:true },
];


export const pad=(n:number)=>String(n).padStart(2,"0");
export const timeToMinutes=(time:string)=>{const [h,m]=time.split(":").map(Number);return h*60+m};
export const toISODate=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
export const addDays=(iso:string,amount:number)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+amount);return toISODate(d)};
export const normalize=(text:string)=>text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
export const similarity=(a:string,b:string)=>{const A=new Set(normalize(a).split(" ").filter(Boolean));const B=new Set(normalize(b).split(" ").filter(Boolean));if(!A.size||!B.size)return 0;const intersection=[...A].filter(w=>B.has(w)).length;return intersection/new Set([...A,...B]).size};
export const fingerprint=(text:string)=>normalize(text).split(" ").sort().join(" ").slice(0,220);
export const clamp=(n:number,min=0,max=1)=>Math.min(max,Math.max(min,n));
export const pct=(n:number)=>`${Math.round(n*100)}%`;
export const emojiPattern=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
export const stopWords=new Set("a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era eres es esa ese eso esta estaba este esto fue ha hay la las le les lo los mas me mi mis muy no nos o para pero por porque que se si sin sobre su sus te tu tus un una unas uno unos ya y yo".split(" "));

export function buildEditorialProfile(items:LibraryItem[]):EditorialProfile{
  const owned=items.filter(x=>x.source!=="reference");
  const historical=owned.filter(x=>x.source==="historical"||x.source==="manual");
  const trainingItems=historical.length>=8?historical:owned;
  const texts=trainingItems.map(x=>x.text.trim()).filter(Boolean);
  const sampleSize=texts.length;
  const totalChars=texts.reduce((n,t)=>n+t.length,0);
  const words=texts.flatMap(t=>normalize(t).split(" ").filter(Boolean));
  const avgChars=sampleSize?Math.round(totalChars/sampleSize):0;
  const avgWords=sampleSize?Math.round(words.length/sampleSize):0;
  const questionRate=sampleSize?texts.filter(t=>t.includes("?")||t.includes("¿")).length/sampleSize:0;
  const emojiRate=sampleSize?texts.filter(t=>emojiPattern.test(t)).length/sampleSize:0;
  const exclamationRate=sampleSize?texts.filter(t=>t.includes("!")||t.includes("¡")).length/sampleSize:0;
  const shortRate=sampleSize?texts.filter(t=>t.length<=120).length/sampleSize:0;
  const catCounts=new Map<string,number>();
  trainingItems.forEach(i=>catCounts.set(i.category,(catCounts.get(i.category)||0)+1));
  const topCategories=[...catCounts.entries()].map(([name,count])=>({name,count,share:sampleSize?count/sampleSize:0})).sort((a,b)=>b.count-a.count).slice(0,8);
  const freq=new Map<string,number>();
  words.filter(w=>w.length>3&&!stopWords.has(w)).forEach(w=>freq.set(w,(freq.get(w)||0)+1));
  const topWords=[...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([w])=>w);
  const hookFreq=new Map<string,number>();
  texts.forEach(t=>{const w=t.trim().split(/\s+/).slice(0,3).join(" ").replace(/[.,!?¡¿:;]+$/g,"");if(w)hookFreq.set(w,(hookFreq.get(w)||0)+1)});
  const hooks=[...hookFreq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([h])=>h);
  const humorousShare=(catCounts.get("Humor")||0)/Math.max(sampleSize,1);
  const emotionalCats=["Relaciones","Nostalgia","Frases identificables","Pensamientos nocturnos","Motivación ligera"].reduce((n,c)=>n+(catCounts.get(c)||0),0)/Math.max(sampleSize,1);
  const reflective=clamp(emotionalCats*.7 + texts.filter(t=>/a veces|tal vez|madurar|recordar|extrañ|paz|vida|tiempo/i.test(t)).length/Math.max(sampleSize,1)*.35);
  const conversational=clamp(questionRate*.85 + texts.filter(t=>/dinos|te pasa|quién|qué|cuál|tú|ustedes/i.test(t)).length/Math.max(sampleSize,1)*.45);
  const humorous=clamp(humorousShare*.8 + texts.filter(t=>/jaja|adulto|economía|vacaciones|dormir|cenar|banco/i.test(t)).length/Math.max(sampleSize,1)*.35);
  const emotional=clamp(emotionalCats*.78 + texts.filter(t=>/amor|cariño|duele|dolió|extrañ|corazón|recuerdo/i.test(t)).length/Math.max(sampleSize,1)*.3);
  const summary=sampleSize===0?"Importa publicaciones históricas para construir la huella editorial de Efímero.":questionRate>=.3?"Voz breve y emocional con una presencia importante de preguntas para activar conversación.":humorous>=.45?"Voz cercana que mezcla identificación cotidiana, emoción y humor ligero.":"Voz breve, cercana y reflexiva, centrada en identificación emocional y lectura rápida.";
  const rules=[
    `Mantener una longitud cercana a ${Math.max(avgWords,6)} palabras por publicación.`,
    questionRate>=.2?`Incluir preguntas en aproximadamente ${Math.round(questionRate*100)}% del contenido.`:"Usar preguntas de forma puntual, no como recurso dominante.",
    emojiRate>=.2?"Los emojis forman parte del estilo; usarlos con moderación y sentido editorial.":"Priorizar texto limpio; los emojis no son necesarios en la mayoría de piezas.",
    shortRate>=.6?"Favorecer publicaciones cortas y fáciles de consumir en el feed.":"Alternar frases cortas con textos de una o dos líneas.",
  ];
  const avoid=["Tono corporativo o explicativo.","Frases motivacionales genéricas sin giro propio.","Repetir el mismo inicio en publicaciones consecutivas.","Sobrecargar una pieza con hashtags o llamadas a la acción."];
  const generationInstruction=`Escribe como Efímero: promedio de ${Math.max(avgWords,6)} palabras, tono ${reflective>=.5?"reflexivo":"cercano"}${emotional>=.5?" y emocional":""}, preguntas en ${Math.round(questionRate*100)}% de las piezas y emojis en ${Math.round(emojiRate*100)}%. Prioriza lectura rápida y lenguaje natural.`;
  return {sampleSize,avgChars,avgWords,questionRate,emojiRate,exclamationRate,shortRate,topCategories,topWords,hooks,tone:{reflective,conversational,humorous,emotional},summary,rules,avoid,generationInstruction,analyzedAt:new Date().toISOString()};
}

export function detectCategory(text:string){
  const t=normalize(text);
  if(/[?¿]/.test(text))return "Preguntas";
  if(/jaja|adulto|banco|dormir|cenar|vacaciones|trabajo|lunes|viernes|economia/.test(t))return "Humor";
  if(/noche|dormir|cama|madrugada|manana/.test(t))return "Pensamientos nocturnos";
  if(/recuerdo|recordar|antes|infancia|cancion|foto|epoca|volver|nostalgia/.test(t))return "Nostalgia";
  if(/amor|pareja|querer|carino|persona|relacion|corazon|quedar|irse|quedarse/.test(t))return "Relaciones";
  if(/avanzar|empezar|seguir|ritmo|puedes|lograr|paso|rendirse/.test(t))return "Motivación ligera";
  if(/cafe|casa|comer|dia|tiempo|plan|comprar|vida adulta/.test(t))return "Vida cotidiana";
  return "Frases identificables";
}


export function calcPerformance(reactions=0,comments=0,shares=0,reach=0){
  const weighted=reactions + comments*2 + shares*4;
  if(reach>0)return Math.round((weighted/reach)*10000)/10;
  return Math.round(Math.log10(weighted+1)*100)/10;
}
export function sourceLabel(source?:LibrarySource){
  if(source==="generated")return "Generado";
  if(source==="historical")return "Efímero histórico";
  if(source==="reference")return "Referencia";
  return "Manual";
}
export function sourceEmoji(source?:LibrarySource){
  if(source==="generated")return "✦";
  if(source==="historical")return "E";
  if(source==="reference")return "↗";
  return "+";
}
export function extractReferencePattern(text:string){
  const t=normalize(text); const words=t.split(" ").filter(Boolean).length;
  const hook=text.trim().split(/\s+/).slice(0,4).join(" ").replace(/[.,!?¡¿:;]+$/g,"");
  const parts=[words<=14?"copy muy corto":words<=28?"copy corto":"copy medio"];
  if(text.includes("?")||text.includes("¿"))parts.push("cierra con pregunta");
  if(/a veces|cuando|hay dias|que raro|nadie|todos|yo|tu|te pasa/.test(t))parts.push("hook identificable");
  if(/amor|extrañ|recuerdo|dol|paz|tiempo|vida|persona/.test(t))parts.push("carga emocional");
  if(/jaja|adulto|dinero|dormir|trabajo|lunes|viernes|cafe/.test(t))parts.push("cotidiano/humor");
  return `${hook?`Hook: “${hook}…” · `:""}${parts.join(" · ")}`;
}
