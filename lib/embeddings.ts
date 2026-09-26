export const embeddingModel=process.env.OPENAI_EMBEDDING_MODEL||"text-embedding-3-small";

export async function createEmbeddings(input:string[]){
  const key=process.env.OPENAI_API_KEY;
  if(!key)throw new Error("Falta OPENAI_API_KEY para indexar el dataset editorial.");
  if(!input.length)return [] as number[][];
  const response=await fetch("https://api.openai.com/v1/embeddings",{
    method:"POST",
    headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:embeddingModel,input}),
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message||"No fue posible generar embeddings.");
  return (data.data||[]).sort((a:any,b:any)=>a.index-b.index).map((x:any)=>x.embedding as number[]);
}

export function vectorLiteral(values:number[]){return `[${values.join(",")}]`;}
