import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";

export async function POST(request:NextRequest){
  const user=await getServerUser();
  if(!user)return NextResponse.json({error:"Inicia sesión para generar imágenes."},{status:401});
  const body=await request.json().catch(()=>({}));
  const style=String(body.style||"editorial abstracta").slice(0,260);
  const aspect=String(body.aspect||"1:1");
  const text=String(body.text||"").trim().slice(0,500);
  const mode=body.mode==="saint-art"?"saint-art":"background";
  const saint=String(body.saint||"").trim().slice(0,100);
  const intention=String(body.intention||"").trim().slice(0,120);
  if(mode==="saint-art"&&!saint)return NextResponse.json({error:"Indica el santo antes de generar su ilustración."},{status:400});
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({source:"local",imageDataUrl:null,message:"OPENAI_API_KEY no está configurada; usa un fondo local."});
  const model=process.env.OPENAI_IMAGE_MODEL||"gpt-image-2.5-flare";
  const size=aspect==="9:16"?"1024x1536":aspect==="4:5"?"1024x1536":"1024x1024";
  const prompt=mode==="saint-art"
    ? `Genera UNA ilustración religiosa original de ${saint}, vinculada con ${intention}, para usar como pieza artística separada en el panel izquierdo de un cartel devocional. Estilo de pintura clásica al óleo: tonos dorados, luz cálida, detalle delicado, paisaje y atmósfera reverente. Inspiración visual: ${style}. Personaje central claramente reconocible a nivel iconográfico cuando sea posible, sin inventar características históricas como hechos. Deja márgenes limpios. NO agregues texto, escritura, tipografías, bordes, marcos, logos, nombres de página, marcas de agua ni iconos sociales. Imagen artística completa, no cartel.`
    : `Crea únicamente el FONDO de una publicación editorial para Facebook. Estilo: ${style}. Debe ser elegante, emocional, contemporáneo, con suficiente espacio negativo al centro para sobreponer texto después. NO incluyas palabras, letras, tipografía, logotipos, marcas de agua ni símbolos de redes sociales. Evita rostros reconocibles. El texto que luego se colocará encima trata sobre: ${text.slice(0,300)}.`;
  try{
    const response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,prompt,size,n:1,output_format:"png",quality:"medium"})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||"No fue posible generar el fondo.");
    const b64=data?.data?.[0]?.b64_json;
    if(!b64)throw new Error("El modelo no devolvió una imagen.");
    return NextResponse.json({source:"openai",model,imageDataUrl:`data:image/png;base64,${b64}`});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible generar la imagen."},{status:502});}
}
