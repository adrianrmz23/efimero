/** Plantillas de Efímero v1.9. Composición determinista: la IA nunca escribe el texto. */
export type CreativeKind = "prayer" | "minimal";
export type CreativeAspect = "1:1" | "4:5" | "9:16";
export type CreativeContent = { kind:CreativeKind; title:string; body:string; saint:string; intention:string };
export type CreativeBrand = { name:string; handle:string; avatar:string; logo:string; accent:string };
export type CreativeAsset = { art:string };
export type CreativeQueueItem = { id:string; fileName:string; dataUrl:string; sourceText:string; pageId:string; caption:string };
export const CREATIVE_DIMENSIONS:Record<CreativeAspect,[number,number]> = {"1:1":[1080,1080],"4:5":[1080,1350],"9:16":[1080,1920]};
const fontSans='Arial, "Helvetica Neue", sans-serif';
const fontSerif='Georgia, "Times New Roman", serif';
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function imageFrom(source:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("No se pudo abrir una imagen de la plantilla."));img.src=source;});}
function crop(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){const ratio=Math.max(w/img.width,h/img.height),sw=w/ratio,sh=h/ratio;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h)}
function linesFor(ctx:CanvasRenderingContext2D,text:string,width:number){const out:string[]=[];for(const paragraph of text.trim().split(/\n+/)){if(!paragraph.trim()){out.push("");continue}let line="";for(const word of paragraph.trim().split(/\s+/)){const candidate=line?`${line} ${word}`:word;if(line&&ctx.measureText(candidate).width>width){out.push(line);line=word}else line=candidate}if(line)out.push(line);}return out;}
function textBlock(ctx:CanvasRenderingContext2D,value:string,rect:{x:number;y:number;w:number;h:number},options:{font:string;size:number;min:number;max?:number;lineHeight:number;align?:CanvasTextAlign;color:string;weight?:string}){
  const text=value.trim(); if(!text)return {fits:true,lines:0,size:options.size};
  let size=options.size;let lines:string[]=[];let height=Infinity;
  do{ctx.font=`${options.weight||"400"} ${size}px ${options.font}`;lines=linesFor(ctx,text,rect.w);height=lines.length*size*options.lineHeight; if(height<=rect.h)break;size-=2;}while(size>=options.min);
  if(height>rect.h)return {fits:false,lines:lines.length,size};
  ctx.fillStyle=options.color;ctx.textAlign=options.align||"left";ctx.textBaseline="top";
  let yy=rect.y;const xx=options.align==="center"?rect.x+rect.w/2:options.align==="right"?rect.x+rect.w:rect.x;
  for(const line of lines){if(line)ctx.fillText(line,xx,yy,rect.w);yy+=size*options.lineHeight;}
  return {fits:true,lines:lines.length,size};
}
function fillPaper(ctx:CanvasRenderingContext2D,w:number,h:number){const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,"#eee0bc");grad.addColorStop(.48,"#f9edcf");grad.addColorStop(1,"#c6a26f");ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  // Grain without randomized layout: repeatable result and no generative expenses.
  for(let i=0;i<360;i++){const x=((i*4337)%1009)/1009*w,y=((i*2399)%1013)/1013*h;ctx.fillStyle=i%2?"rgba(93,55,20,.055)":"rgba(255,250,230,.13)";ctx.fillRect(x,y,2+(i%3),1+(i%2));}}
function ornate(ctx:CanvasRenderingContext2D,w:number,h:number){ctx.strokeStyle="#95651f";ctx.lineWidth=8;rounded(ctx,19,19,w-38,h-38,20);ctx.stroke();ctx.strokeStyle="#e7b958";ctx.lineWidth=3;rounded(ctx,31,31,w-62,h-62,14);ctx.stroke();
 for(const sx of [1,-1])for(const sy of [1,-1]){ctx.save();ctx.translate(sx>0?42:w-42,sy>0?42:h-42);ctx.scale(sx,sy);ctx.strokeStyle="#9f6b25";ctx.lineWidth=6;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(0,110-i*12);ctx.bezierCurveTo(18+i*8,56,90,65-i*7,101,0);ctx.stroke();}for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(26+i*20,24+i*12,12,26,Math.PI/4,0,Math.PI*2);ctx.stroke();}ctx.restore();}}
export async function drawCreative(canvas:HTMLCanvasElement,content:CreativeContent,brand:CreativeBrand,assets:CreativeAsset,aspect:CreativeAspect):Promise<{dataUrl:string;error?:string}>{
 const [w,h]=CREATIVE_DIMENSIONS[aspect];canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No se pudo iniciar Canvas.");const isPrayer=content.kind==="prayer";
 let fits=true;
 if(isPrayer){
   fillPaper(ctx,w,h);
   if(assets.art){const art=await imageFrom(assets.art);ctx.save();ctx.beginPath();ctx.rect(40,40,w*.44,h-80);ctx.clip();crop(ctx,art,40,40,w*.53,h-80);ctx.restore();const fade=ctx.createLinearGradient(w*.32,0,w*.69,0);fade.addColorStop(0,"rgba(243,228,195,0)");fade.addColorStop(1,"rgba(248,235,205,1)");ctx.fillStyle=fade;ctx.fillRect(w*.3,36,w*.44,h-72)}
   else {const g=ctx.createLinearGradient(0,0,w*.48,h);g.addColorStop(0,"#d6c395");g.addColorStop(1,"#936b38");ctx.fillStyle=g;ctx.fillRect(40,40,w*.42,h-80);ctx.fillStyle="rgba(255,244,214,.65)";ctx.beginPath();ctx.arc(w*.22,h*.31,105,0,Math.PI*2);ctx.fill();ctx.fillStyle="#66431d";ctx.font=`700 ${Math.floor(w*.025)}px ${fontSerif}`;ctx.textAlign="center";ctx.fillText("ILUSTRACIÓN",w*.24,h*.63);ctx.fillText("DEL SANTO",w*.24,h*.67);}
   // Headings respect artwork left and body right, similar to the supplied example but not a pixel copy.
   const rightX=w*.48, rightW=w*.45;
   let t=textBlock(ctx,"Oración a",{x:rightX,y:h*.045,w:rightW,h:h*.07},{font:fontSerif,size:w*.045,min:30,lineHeight:1.1,align:"center",color:"#372914"});fits&&=t.fits;
   t=textBlock(ctx,content.saint||"Santo o advocación",{x:rightX-20,y:h*.105,w:rightW+40,h:h*.13},{font:fontSerif,size:w*.055,min:32,lineHeight:1.03,align:"center",weight:"700",color:"#382c18"});fits&&=t.fits;
   t=textBlock(ctx,content.intention||"fe y esperanza",{x:rightX,y:h*.238,w:rightW,h:h*.065},{font:fontSerif,size:w*.031,min:24,lineHeight:1.1,align:"center",color:"#49341e"});fits&&=t.fits;
   ctx.strokeStyle="#aa7b39";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(rightX+35,h*.31);ctx.lineTo(rightX+rightW-35,h*.31);ctx.stroke();
   const bodyY=h*.335,bodyEnd=h*.875;
   t=textBlock(ctx,content.body,{x:rightX+8,y:bodyY,w:rightW-16,h:bodyEnd-bodyY},{font:fontSerif,size:w*.028,min:22,lineHeight:1.31,align:"center",color:"#30251a"});fits&&=t.fits;
   ctx.fillStyle="#3c3d23";ctx.font=`700 ${w*.025}px ${fontSans}`;ctx.textAlign="center";
   if(brand.logo){const logo=await imageFrom(brand.logo);crop(ctx,logo,w*.668,h*.89,w*.082,w*.052);}
   ctx.fillText(brand.name||"TU PÁGINA",w*.73,h*.918,w*.42);
   ornate(ctx,w,h);
 }else{
   ctx.fillStyle="#fffefe";ctx.fillRect(0,0,w,h);
   const pad=w*.055, top=h*.28,avatarR=w*.07;
   if(brand.avatar){const avatar=await imageFrom(brand.avatar);ctx.save();ctx.beginPath();ctx.arc(pad+avatarR,top+avatarR,avatarR,0,Math.PI*2);ctx.clip();crop(ctx,avatar,pad,top,avatarR*2,avatarR*2);ctx.restore();}
   else {ctx.fillStyle="#222024";ctx.beginPath();ctx.arc(pad+avatarR,top+avatarR,avatarR,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.font=`700 ${w*.064}px ${fontSans}`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText((brand.name||"E").trim().slice(0,1).toUpperCase(),pad+avatarR,top+avatarR);}
   const bylineX=pad+avatarR*2+w*.026;
   let t=textBlock(ctx,brand.name||"Nombre de tu página",{x:bylineX,y:top+avatarR*.27,w:w-bylineX-pad,h:avatarR*.65},{font:fontSans,size:w*.041,min:25,lineHeight:1.1,weight:"700",color:"#111111"});fits&&=t.fits;
   if(brand.handle){t=textBlock(ctx,brand.handle,{x:bylineX,y:top+avatarR*1.07,w:w-bylineX-pad,h:avatarR*.65},{font:fontSans,size:w*.035,min:23,lineHeight:1.1,color:"#777780"});fits&&=t.fits;}
   const titleY=top+avatarR*2+h*.055;
   t=textBlock(ctx,content.title||"Reflexión",{x:pad,y:titleY,w:w-2*pad,h:h*.13},{font:fontSans,size:w*.056,min:36,lineHeight:1.17,color:"#0d0d0d"});fits&&=t.fits;
   const bodyY=titleY+h*.135;
   t=textBlock(ctx,content.body,{x:pad,y:bodyY,w:w-2*pad,h:h*.92-bodyY},{font:fontSans,size:w*.056,min:28,lineHeight:1.42,color:"#080808"});fits&&=t.fits;
 }
 if(!fits)return {dataUrl:"",error:"El texto es demasiado largo para este formato. Acorta la oración o elige una imagen más vertical."};
 return {dataUrl:canvas.toDataURL("image/jpeg",.91)};
}
export function splitCreativeBatch(raw:string,kind:CreativeKind,defaults:CreativeContent):CreativeContent[]{
  // One item per --- separator. Prayer: optional first line `Santo | Intención`.
  return raw.split(/^\s*---\s*$/m).map(chunk=>chunk.trim()).filter(Boolean).slice(0,12).map(chunk=>{
    if(kind==="prayer"){
      const lines=chunk.split("\n"); const head=lines[0]||"";
      if(head.includes("|")){const [saint,intention]=head.split("|").map(s=>s.trim());return {...defaults,kind,saint:saint||defaults.saint,intention:intention||defaults.intention,body:lines.slice(1).join("\n").trim()};}
      return {...defaults,kind,body:chunk};
    }
    const lines=chunk.split("\n");const head=lines[0]||"";
    if(head.includes("|")){const [title,...more]=head.split("|");return {...defaults,kind,title:title.trim()||defaults.title,body:[more.join("|").trim(),...lines.slice(1)].filter(Boolean).join("\n")};}
    return {...defaults,kind,body:chunk};
  });
}
