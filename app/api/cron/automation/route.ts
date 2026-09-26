import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { publishToFacebook } from "@/lib/metaPublish";

export const dynamic="force-dynamic";

async function authorized(request:NextRequest){
  const secret=(process.env.CRON_SECRET||"").trim();
  const auth=request.headers.get("authorization")||"";
  if(secret&&auth===`Bearer ${secret}`)return true;
  return Boolean(await getServerUser());
}

async function runAutomation(limit=12){
  const admin=getSupabaseAdmin();
  const now=new Date().toISOString();
  const {data:rows,error}=await admin.from("efimero_scheduled_posts")
    .select("id,publish_at,publish_at_utc,text,category,format,status,page_id,page_name,compliance_data,image_url,meta_post_id,publish_error")
    .in("status",["Aprobado","approved"])
    .not("page_id","is",null)
    .order("publish_at",{ascending:true})
    .limit(Math.max(5,Math.min(60,limit*3)));
  if(error)throw error;

  const results:any[]=[];
  const due=(rows||[]).filter((row:any)=>{const stamp=row.publish_at_utc||`${String(row.publish_at).replace(" ","T")}-06:00`;return new Date(stamp).getTime()<=Date.now();}).slice(0,Math.max(1,Math.min(30,limit)));
  for(const row of due){
    if(row.meta_post_id){results.push({id:row.id,status:"skip",reason:"already_published"});continue;}
    if(row.compliance_data?.status!=="pass"){
      await admin.from("efimero_publish_jobs").upsert({scheduled_post_id:row.id,state:"blocked",last_error:"Compliance no está en PASS",updated_at:new Date().toISOString()},{onConflict:"scheduled_post_id"});
      results.push({id:row.id,status:"blocked"});continue;
    }
    const {data:job}=await admin.from("efimero_publish_jobs").select("*").eq("scheduled_post_id",row.id).maybeSingle();
    if(job?.state==="published"){results.push({id:row.id,status:"skip",reason:"job_published"});continue;}
    if(job?.state==="processing"&&job?.processing_started_at&&Date.now()-new Date(job.processing_started_at).getTime()<30*60*1000){results.push({id:row.id,status:"skip",reason:"locked"});continue;}
    const attempts=Number(job?.attempts||0)+1;
    await admin.from("efimero_publish_jobs").upsert({scheduled_post_id:row.id,state:"processing",attempts,processing_started_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()},{onConflict:"scheduled_post_id"});
    try{
      const published=await publishToFacebook({pageId:String(row.page_id),message:String(row.text||""),imageUrl:String(row.image_url||""),publishNow:true,scheduledPostId:String(row.id)});
      await admin.from("efimero_publish_jobs").update({state:"published",meta_post_id:published.id,published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("scheduled_post_id",row.id);
      results.push({id:row.id,status:"published",metaPostId:published.id});
    }catch(error:any){
      const delay=Math.min(360,Math.pow(2,Math.min(attempts,6))*5);
      const nextRetry=new Date(Date.now()+delay*60*1000).toISOString();
      await admin.from("efimero_publish_jobs").update({state:attempts>=5?"failed":"retry",last_error:error?.message||"Error",next_retry_at:nextRetry,updated_at:new Date().toISOString()}).eq("scheduled_post_id",row.id);
      await admin.from("efimero_scheduled_posts").update({status:attempts>=5?"Error":"Aprobado",publish_error:error?.message||"Error"}).eq("id",row.id);
      results.push({id:row.id,status:"error",error:error?.message||"Error"});
    }
  }
  return {checked:due.length,results};
}

export async function GET(request:NextRequest){
  if(!(await authorized(request)))return NextResponse.json({error:"No autorizado."},{status:401});
  try{return NextResponse.json({ok:true,ranAt:new Date().toISOString(),...(await runAutomation())});}
  catch(error:any){return NextResponse.json({error:error?.message||"Falló el scheduler."},{status:500});}
}
export async function POST(request:NextRequest){
  if(!(await authorized(request)))return NextResponse.json({error:"No autorizado."},{status:401});
  const body=await request.json().catch(()=>({}));
  try{return NextResponse.json({ok:true,ranAt:new Date().toISOString(),...(await runAutomation(Number(body.limit||12)))});}
  catch(error:any){return NextResponse.json({error:error?.message||"Falló el scheduler."},{status:500});}
}
