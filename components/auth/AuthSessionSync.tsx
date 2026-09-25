"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

async function sync(accessToken?:string){
  if(!accessToken)return;
  await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken})});
}

export default function AuthSessionSync(){
  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getSession().then(({data})=>sync(data.session?.access_token));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT")fetch("/api/auth/session",{method:"DELETE"}).catch(()=>{});
      else sync(session?.access_token).catch(()=>{});
    });
    return()=>subscription.unsubscribe();
  },[]);
  return null;
}
