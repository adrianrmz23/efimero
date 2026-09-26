import { NextRequest, NextResponse } from "next/server";
import { evaluateEditorialText } from "@/lib/editorialScoring";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerUser } from "@/lib/serverAuth";

export async function POST(request:NextRequest){
  const user=await getServerUser();
  if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  const body=await request.json().catch(()=>({}));
  const text=String(body.text||"").trim();
  if(!text)return NextResponse.json({error:"Falta el texto a evaluar."},{status:400});
  try{
    const result=await evaluateEditorialText({text,category:String(body.category||""),targetWords:Number(body.targetWords||18),pageId:body.pageId?String(body.pageId):null});
    try{
      const admin=getSupabaseAdmin();
      await admin.from("efimero_editorial_scores").insert({owner_user_id:user.id,text,category:String(body.category||"General"),page_id:body.pageId?String(body.pageId):null,score:result.score,verdict:result.verdict,breakdown:result.breakdown,reasons:result.reasons,warnings:result.warnings,nearest:result.nearest,compliance_data:result.compliance});
    }catch{}
    return NextResponse.json({ok:true,result});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"No fue posible calcular el score editorial."},{status:500});
  }
}
