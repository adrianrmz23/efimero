"use client";
import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    supabase?.auth.getSession().then(async({data})=>{
      const token=data.session?.access_token;if(!token)return;
      const r=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken:token})});
      if(r.ok)window.location.replace("/");
    });
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();setError("");
    if(!isSupabaseConfigured||!supabase){setError("Supabase Auth todavía no está configurado.");return}
    setBusy(true);
    try{
      const {data,error:authError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
      if(authError)throw new Error("Correo o contraseña incorrectos.");
      if(!data.session?.access_token)throw new Error("Supabase no devolvió una sesión válida.");
      const r=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken:data.session.access_token})});
      const d=await r.json();
      if(!r.ok){await supabase.auth.signOut();throw new Error(d.error||"Tu cuenta no está autorizada.")}
      window.location.replace("/");
    }catch(err:any){setError(err?.message||"No fue posible iniciar sesión.")}finally{setBusy(false)}
  }

  return <main className="privateLoginPage">
    <section className="privateLoginCard">
      <div className="loginBrand"><div className="brandGlyph loginGlyph">E</div><div><strong>EFÍMERO</strong><span>CONTENT ENGINE</span></div></div>
      <div className="loginShield"><ShieldCheck size={25}/></div>
      <span className="overline">ACCESO PRIVADO</span>
      <h1>Tu fábrica editorial, protegida.</h1>
      <p>Inicia sesión con la cuenta autorizada. No existe registro público y las rutas de Meta, IA y Supabase quedan protegidas por sesión.</p>
      <form onSubmit={submit} className="privateLoginForm">
        <label><span>Correo</span><input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
        <label><span>Contraseña</span><div className="passwordField"><LockKeyhole size={17}/><input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••••"/></div></label>
        {error&&<div className="loginError">{error}</div>}
        <button disabled={busy} className="loginSubmit" type="submit">{busy?<LoaderCircle className="spin" size={18}/>:<LogIn size={18}/>} {busy?"Comprobando…":"Entrar a Efímero"}</button>
      </form>
      <div className="loginFoot"><ShieldCheck size={14}/> Sesión privada · sin registro público</div>
    </section>
  </main>
}
