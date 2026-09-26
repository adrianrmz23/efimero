import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbeddings, vectorLiteral } from "@/lib/embeddings";

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));const query=String(body.query||"").trim();if(!query)return NextResponse.json({error:"Falta query."},{status:400});
  try{const admin=getSupabaseAdmin();const [embedding]=await createEmbeddings([query]);const {data,error}=await admin.rpc("match_efimero_dataset",{query_embedding:vectorLiteral(embedding),match_count:Math.max(1,Math.min(30,Number(body.limit||12))),filter_category:String(body.category||"")||null});if(error)throw error;return NextResponse.json({ok:true,items:data||[]});}
  catch(error:any){return NextResponse.json({error:error?.message||"No fue posible buscar en el dataset."},{status:500});}
}
