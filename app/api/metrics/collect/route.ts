import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAnyStoredPageToken, metaGraphGet } from "@/lib/metaServer";
import { getServerUser } from "@/lib/serverAuth";

const checkpoints=[{key:"1h",hours:1},{key:"24h",hours:24},{key:"72h",hours:72},{key:"7d",hours:168}];

async function authorized(request:NextRequest){
  const secret=(process.env.CRON_SECRET||"").trim();
  if(secret&&(request.headers.get("authorization")||"")===`Bearer ${secret}`)return true;
  return Boolean(await getServerUser());
}

export async function POST(request:NextRequest){
  if(!(await authorized(request)))return NextResponse.json({error:"No autorizado."},{status:401});
  try{
    const admin=getSupabaseAdmin();
    const {data:posts,error}=await admin.from("efimero_scheduled_posts")
      .select("id,page_id,page_name,meta_post_id,publish_at,published_at_actual,text,category,format")
      .not("meta_post_id","is",null)
      .in("status",["Publicado","published","Programado"])
      .order("publish_at",{ascending:false}).limit(300);
    if(error)throw error;
    let collected=0;
    for(const post of posts||[]){
      const baseTime=new Date(post.published_at_actual||post.publish_at).getTime();
      if(!Number.isFinite(baseTime))continue;
      const ageHours=(Date.now()-baseTime)/3600000;
      for(const checkpoint of checkpoints){
        if(ageHours<checkpoint.hours)continue;
        const {data:existing}=await admin.from("efimero_metric_snapshots").select("id").eq("scheduled_post_id",post.id).eq("checkpoint",checkpoint.key).maybeSingle();
        if(existing)continue;
        try{
          const token=(await resolveAnyStoredPageToken(String(post.page_id))).token;
          const metrics=await metaGraphGet(String(post.meta_post_id),{fields:"id,created_time,permalink_url,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)",access_token:token});
          const reactions=Number(metrics?.reactions?.summary?.total_count||0),comments=Number(metrics?.comments?.summary?.total_count||0),shares=Number(metrics?.shares?.count||0);
          const score=Math.round((reactions+comments*2+shares*4)*100)/100;
          await admin.from("efimero_metric_snapshots").insert({scheduled_post_id:post.id,page_id:post.page_id,meta_post_id:post.meta_post_id,checkpoint:checkpoint.key,reactions,comments,shares,performance_score:score,raw:metrics});
          await admin.from("efimero_scheduled_posts").update({last_metrics_sync_at:new Date().toISOString()}).eq("id",post.id);
          const libraryRow={text:post.text,category:post.category,format:post.format||"Texto",source:"generated",platform:"facebook",platform_post_id:post.meta_post_id,source_page_id:post.page_id,source_page_name:post.page_name||null,published_at:new Date(baseTime).toISOString(),reactions,comments,shares,performance_score:score,last_synced_at:new Date().toISOString()};
          const {data:existingLibrary}=await admin.from("efimero_content_library").select("id").eq("platform_post_id",post.meta_post_id).maybeSingle();
          if(existingLibrary?.id)await admin.from("efimero_content_library").update(libraryRow).eq("id",existingLibrary.id);
          else await admin.from("efimero_content_library").insert(libraryRow);
          collected++;
        }catch{}
      }
    }
    return NextResponse.json({ok:true,collected,checked:(posts||[]).length,checkedAt:new Date().toISOString()});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible recuperar métricas."},{status:500});}
}
