"use client";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LogoutButton(){
  async function logout(){
    try{await supabase?.auth.signOut()}finally{
      await fetch("/api/auth/session",{method:"DELETE"}).catch(()=>{});
      window.location.href="/login";
    }
  }
  return <button className="logoutButton" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={16}/><span>Cerrar sesión</span></button>;
}
