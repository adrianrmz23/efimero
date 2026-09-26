import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateWeeklyReport } from "@/lib/weeklyReport";

export const dynamic="force-dynamic";
export async function GET(){const user=await getServerUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});try{const admin=getSupabaseAdmin();const {data,error}=await admin.from("efimero_weekly_reports").select("*").eq("owner_user_id",user.id).order("created_at",{ascending:false}).limit(8);if(error)throw error;return NextResponse.json({ok:true,items:data||[]})}catch(error:any){return NextResponse.json({error:error?.message||"No fue posible cargar reportes."},{status:500})}}
export async function POST(request:NextRequest){const user=await getServerUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});const body=await request.json().catch(()=>({}));try{return NextResponse.json({ok:true,...await generateWeeklyReport(user.id,body.pageId?String(body.pageId):undefined)})}catch(error:any){return NextResponse.json({error:error?.message||"No fue posible generar el reporte semanal."},{status:500})}}
