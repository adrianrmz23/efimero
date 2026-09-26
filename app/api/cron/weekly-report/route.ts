import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateWeeklyReport } from "@/lib/weeklyReport";

export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET||"";const auth=request.headers.get("authorization")||"";if(!secret||auth!==`Bearer ${secret}`)return NextResponse.json({error:"No autorizado."},{status:401});
  try{const admin=getSupabaseAdmin();const {data,error}=await admin.from("efimero_meta_connections").select("owner_user_id,active_page_id").eq("status","connected").limit(10);if(error)throw error;const results=[];for(const row of data||[]){try{results.push({ownerUserId:row.owner_user_id,ok:true,report:await generateWeeklyReport(String(row.owner_user_id),row.active_page_id?String(row.active_page_id):undefined)})}catch(e:any){results.push({ownerUserId:row.owner_user_id,ok:false,error:e?.message||"Falló reporte"})}}return NextResponse.json({ok:true,results})}catch(error:any){return NextResponse.json({error:error?.message||"No fue posible ejecutar el reporte automático."},{status:500})}
}
