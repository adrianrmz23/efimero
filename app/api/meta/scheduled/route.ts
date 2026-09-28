import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildAppSecretProof, metaGraphBase } from "@/lib/metaServer";
import { graphGet, resolvePageToken } from "../_shared";

export const dynamic = "force-dynamic";

type ScheduledPost = {
  id:string;
  message?:string;
  scheduled_publish_time?:number;
  created_time?:string;
  is_published?:boolean;
};

async function listAllScheduled(pageId:string,token:string){
  const posts:ScheduledPost[]=[];
  let after="";
  for(let page=0;page<5;page++){
    const response=await graphGet(`${pageId}/scheduled_posts`,{
      fields:"id,message,scheduled_publish_time,created_time,is_published",
      limit:100,
      after:after||undefined,
      access_token:token,
    });
    posts.push(...(Array.isArray(response?.data)?response.data:[]));
    const next=String(response?.paging?.cursors?.after||"");
    if(!next||next===after)break;
    after=next;
  }
  return posts;
}

async function deleteMetaPost(postId:string,token:string){
  const url=new URL(postId.replace(/^\//,""),metaGraphBase);
  url.searchParams.set("access_token",token);
  const proof=buildAppSecretProof(token);if(proof)url.searchParams.set("appsecret_proof",proof);
  const response=await fetch(url,{method:"DELETE",cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.error){
    const error:any=new Error(data?.error?.message||`Meta Graph API respondió ${response.status}`);
    error.code=data?.error?.code;
    throw error;
  }
  return data;
}

export async function GET(request:NextRequest){
  try{
    const pageId=String(request.nextUrl.searchParams.get("pageId")||"").trim();
    if(!pageId)return NextResponse.json({error:"Falta pageId."},{status:400});
    const token=await resolvePageToken(pageId);
    const posts=await listAllScheduled(pageId,token);
    const intervalMinutes=Math.min(720,Math.max(5,Math.round(Number(request.nextUrl.searchParams.get("intervalMinutes")||30)||30)));
    const futureEpochs=posts.map(post=>Number(post.scheduled_publish_time||0)).filter(value=>Number.isFinite(value)&&value>0);
    const lastScheduledPublishTime=futureEpochs.length?Math.max(...futureEpochs):null;
    const minFutureEpoch=Math.ceil((Date.now()+10*60_000)/1000);
    const rawSuggested=Math.max(minFutureEpoch,lastScheduledPublishTime?lastScheduledPublishTime+intervalMinutes*60:0);
    const suggestedNextPublishTime=Math.ceil(rawSuggested/(5*60))*(5*60);

    const admin=getSupabaseAdmin();
    const ids=posts.map(x=>String(x.id)).filter(Boolean);
    let local:any[]=[];
    if(ids.length){
      const {data}=await admin.from("efimero_scheduled_posts")
        .select("id,meta_post_id,page_id,page_name,publish_at,text,category,format,status")
        .eq("page_id",pageId)
        .in("meta_post_id",ids);
      local=data||[];
    }
    const byMeta=new Map(local.map((x:any)=>[String(x.meta_post_id),x]));
    return NextResponse.json({
      ok:true,pageId,count:posts.length,
      lastScheduledPublishTime,
      suggestedNextPublishTime,
      intervalMinutes,
      posts:posts.map(post=>({
        id:String(post.id),
        message:String(post.message||""),
        scheduledPublishTime:Number(post.scheduled_publish_time||0),
        createdTime:post.created_time||null,
        isPublished:Boolean(post.is_published),
        local:byMeta.get(String(post.id))||null,
      })),
    });
  }catch(error:any){
    return NextResponse.json({error:error?.message||"No fue posible consultar la cola de Meta."},{status:502});
  }
}

export async function DELETE(request:NextRequest){
  try{
    const body=await request.json().catch(()=>({}));
    const pageId=String(body.pageId||"").trim();
    const incoming:unknown[]=Array.isArray(body.postIds)?body.postIds:[body.postId];
    const postIds:string[]=[...new Set<string>(incoming.map((x)=>String(x??"").trim()).filter((x)=>x.length>0))].slice(0,100);
    if(!pageId)return NextResponse.json({error:"Falta pageId."},{status:400});
    if(!postIds.length)return NextResponse.json({error:"No hay publicaciones para cancelar."},{status:400});

    const token=await resolvePageToken(pageId);
    const results:{id:string;ok:boolean;error?:string}[]=[];
    for(const postId of postIds){
      try{
        await deleteMetaPost(postId,token);
        results.push({id:postId,ok:true});
      }catch(error:any){
        results.push({id:postId,ok:false,error:error?.message||"Meta rechazó la cancelación."});
      }
    }
    const succeeded=results.filter(x=>x.ok).map(x=>x.id);
    if(succeeded.length){
      const admin=getSupabaseAdmin();
      await admin.from("efimero_scheduled_posts").delete().eq("page_id",pageId).in("meta_post_id",succeeded);
    }
    const failed=results.filter(x=>!x.ok);
    return NextResponse.json({ok:failed.length===0,cancelled:succeeded.length,failed:failed.length,results},{status:failed.length&&succeeded.length===0?502:200});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"No fue posible cancelar la programación."},{status:502});
  }
}
