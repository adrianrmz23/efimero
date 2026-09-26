import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { localComplianceReview } from "@/lib/metaCompliance";
import { resolveStoredPageToken } from "@/lib/metaServer";

const fingerprint=(text:string)=>String(text||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim().split(" ").sort().join(" ").slice(0,220);
export async function POST(request:NextRequest){
  const user=await getServerUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  const body=await request.json().catch(()=>({}));const pageId=String(body.pageId||"");const items=Array.isArray(body.items)?body.items.slice(0,12):[];
  if(!pageId||!items.length)return NextResponse.json({error:"Faltan página o propuestas."},{status:400});
  try{
    const admin=getSupabaseAdmin();const page=await resolveStoredPageToken(user.id,pageId);const rows:any[]=[];const rejected:any[]=[];
    for(const item of items){const text=String(item.text||"").trim();const compliance=localComplianceReview(text);if(!text||compliance.status!=="pass"){rejected.push({text,status:compliance.status});continue}const date=String(item.date||"");const time=String(item.time||"12:00");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;const id=crypto.randomUUID();rows.push({id,publish_at:`${date}T${time}:00`,publish_at_utc:new Date(`${date}T${time}:00-06:00`).toISOString(),text,category:String(item.category||"Frases identificables"),format:"Texto",status:"approved",fingerprint:fingerprint(text),similarity_score:0,page_id:pageId,page_name:page.pageName,compliance_data:item.compliance||compliance,editorial_score:Number(item.score?.score||0),score_data:item.score||{},autopilot:true})}
    if(rows.length){const {error}=await admin.from("efimero_scheduled_posts").insert(rows);if(error)throw error}
    return NextResponse.json({ok:true,queued:rows,rejected});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible enviar las propuestas a Bandeja."},{status:500});}
}
