"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Heart, Info, Loader2, Megaphone, PauseCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { usePages } from "@/lib/pagesContext";
import { useConfirm } from "@/components/ui/DialogProvider";

type Account={id:string;name:string;currency:string;timezone:string;active:boolean};
type Post={id:string;message:string;createdTime:string|null;picture:string|null;reactions:number;comments:number;shares:number};
type Result={id:string;name:string;status:string;objective:string;createdTime:string|null;url:string;spend:number;likes:number;impressions:number;reach:number;costPerLike:number|null};
type Totals={spend:number;likes:number;costPerLike:number|null};

const COUNTRIES:Array<[string,string]>=[["MX","México"],["US","Estados Unidos"],["GT","Guatemala"],["HN","Honduras"],["SV","El Salvador"],["NI","Nicaragua"],["CR","Costa Rica"],["PA","Panamá"],["CO","Colombia"],["VE","Venezuela"],["EC","Ecuador"],["PE","Perú"],["BO","Bolivia"],["CL","Chile"],["AR","Argentina"],["PY","Paraguay"],["UY","Uruguay"],["DO","Rep. Dominicana"],["PR","Puerto Rico"],["ES","España"]];
const PRESETS:Array<[string,string]>=[["last_7d","Últimos 7 días"],["last_30d","Últimos 30 días"],["last_90d","Últimos 90 días"],["maximum","Todo"]];
const STATUS:Record<string,[string,string]>={ACTIVE:["Activa","success"],PAUSED:["En pausa","neutral"],CAMPAIGN_PAUSED:["En pausa","neutral"],ADSET_PAUSED:["En pausa","neutral"],IN_PROCESS:["En revisión","warning"],PENDING_REVIEW:["En revisión","warning"],WITH_ISSUES:["Con problemas","danger"],DISAPPROVED:["Rechazada","danger"],ARCHIVED:["Archivada","neutral"],DELETED:["Eliminada","neutral"]};
const ACCOUNT_KEY="efimero:ads:account";

export default function AdsManager(){
  const {pages,activePageId}=usePages();
  const confirm=useConfirm();
  const [loading,setLoading]=useState(true);const [hasScope,setHasScope]=useState(true);const [accounts,setAccounts]=useState<Account[]>([]);const [cap,setCap]=useState(200);const [accountId,setAccountId]=useState("");
  const [pageId,setPageId]=useState("");const [posts,setPosts]=useState<Post[]>([]);const [postsLoading,setPostsLoading]=useState(false);const [postId,setPostId]=useState("");
  const [name,setName]=useState("");const [dailyBudget,setDailyBudget]=useState(50);const [days,setDays]=useState(7);const [countries,setCountries]=useState<string[]>(["MX"]);const [ageMin,setAgeMin]=useState(25);const [ageMax,setAgeMax]=useState(65);
  const [creating,setCreating]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState<{text:string;url?:string}|null>(null);
  const [preset,setPreset]=useState("last_30d");const [results,setResults]=useState<Result[]>([]);const [totals,setTotals]=useState<Totals|null>(null);const [resultsLoading,setResultsLoading]=useState(false);
  const account=accounts.find(a=>a.id===accountId);
  const currency=account?.currency||"MXN";
  const money=(n:number)=>new Intl.NumberFormat("es-MX",{style:"currency",currency,maximumFractionDigits:n<10?2:0}).format(n);
  const page=pages.find(p=>p.id===pageId);

  useEffect(()=>{void loadAccounts()},[]);
  useEffect(()=>{if(!pageId&&activePageId)setPageId(activePageId)},[activePageId,pageId]);
  useEffect(()=>{if(pageId)void loadPosts(pageId)},[pageId]);
  useEffect(()=>{if(accountId)void loadResults()},[accountId,preset]);
  useEffect(()=>{if(page&&!name)setName(`Me gusta · ${page.name}`)},[page,name]);

  async function loadAccounts(){
    setLoading(true);setError("");
    try{const r=await fetch("/api/ads/accounts",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron leer las cuentas.");
      setHasScope(Boolean(d.hasScope));setAccounts(d.accounts||[]);setCap(Number(d.maxDailyBudget||200));
      let saved="";try{saved=localStorage.getItem(ACCOUNT_KEY)||""}catch{/* Sin almacenamiento local. */}
      const list:Account[]=d.accounts||[];setAccountId(list.find(a=>a.id===saved)?.id||list.find(a=>a.active)?.id||list[0]?.id||"");}
    catch(e:any){setError(e?.message||"No se pudieron leer las cuentas.")}finally{setLoading(false)}
  }
  async function loadPosts(id:string){
    setPostsLoading(true);setPostId("");
    try{const r=await fetch(`/api/meta/posts?${new URLSearchParams({pageId:id,limit:"25"})}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron leer las publicaciones.");
      // Las de más interacción primero: suelen dar Me gusta más baratos.
      const sorted=[...(d.posts||[])].sort((a:Post,b:Post)=>(b.reactions+b.comments*3+b.shares*4)-(a.reactions+a.comments*3+a.shares*4));setPosts(sorted);setPostId(sorted[0]?.id||"");}
    catch(e:any){setPosts([]);setError(e?.message||"No se pudieron leer las publicaciones.")}finally{setPostsLoading(false)}
  }
  async function loadResults(){
    setResultsLoading(true);
    try{const r=await fetch(`/api/ads/campaigns?${new URLSearchParams({accountId,datePreset:preset})}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudieron leer los resultados.");setResults(d.items||[]);setTotals(d.totals||null)}
    catch(e:any){setError(e?.message||"No se pudieron leer los resultados.")}finally{setResultsLoading(false)}
  }
  function chooseAccount(id:string){setAccountId(id);try{localStorage.setItem(ACCOUNT_KEY,id)}catch{/* Sin almacenamiento local. */}}
  function toggleCountry(code:string){setCountries(cur=>cur.includes(code)?cur.filter(c=>c!==code):[...cur,code])}

  const budgetError=dailyBudget>cap?`El tope diario es ${money(cap)}.`:dailyBudget<=0?"Escribe un presupuesto.":"";
  const totalMax=dailyBudget*days;
  const canCreate=Boolean(account?.active&&pageId&&postId&&countries.length&&!budgetError&&ageMin<=ageMax);

  async function create(){
    if(!canCreate||!account)return;
    const ok=await confirm({title:"¿Crear la campaña en pausa?",description:`${name}\nPágina: ${page?.name||pageId}\nPresupuesto: ${money(dailyBudget)} al día durante ${days} ${days===1?"día":"días"} (máximo ${money(totalMax)}).\nPaíses: ${countries.join(", ")} · Edad ${ageMin}-${ageMax}\n\nSe crea EN PAUSA y no gasta nada hasta que tú la actives en el Administrador de anuncios.`,confirmLabel:"Crear en pausa"});
    if(!ok)return;
    setCreating(true);setError("");setNotice(null);
    try{const r=await fetch("/api/ads/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accountId,pageId,postId,name,dailyBudget,days,countries,ageMin,ageMax})});const d=await r.json();
      if(!r.ok){setError(d.error||"No se pudo crear la campaña.");if(d.url)setNotice({text:"Una parte se alcanzó a crear y quedó en pausa. Puedes terminarla o borrarla en el Administrador de anuncios.",url:d.url});return}
      setNotice({text:`Campaña creada en pausa. Gasto máximo si la activas: ${money(d.totalMax)}.`,url:d.url});void loadResults();}
    catch(e:any){setError(e?.message||"No se pudo crear la campaña.")}finally{setCreating(false)}
  }

  const likeResults=useMemo(()=>results.filter(r=>r.likes>0||r.objective==="OUTCOME_ENGAGEMENT"||r.objective==="PAGE_LIKES"),[results]);

  return <div className="adsPage">
    <div className="pageIntro"><div><span className="overline">CRECER</span><h1>Anuncios de Me gusta</h1><p>Crea campañas para ganar Me gusta en tus páginas. Todo se crea en pausa y con presupuesto tope: nada gasta hasta que tú lo actives.</p></div>{accountId&&<a className="uiBtn uiBtnSecondary" href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId.replace(/^act_/,"")}`} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Administrador de anuncios</a>}</div>

    {loading?<div className="calPanel adsEmpty"><Loader2 className="spin" size={18}/><span>Leyendo tus cuentas publicitarias…</span></div>:!hasScope?<section className="calPanel adsConnect">
      <div className="adsConnectIcon"><Megaphone size={20}/></div>
      <div><h2>Falta dar permiso de anuncios</h2><p>Facebook ya está conectado para publicar, pero para crear campañas necesita los permisos <b>ads_management</b> y <b>ads_read</b>. Se abrirá Facebook para que los apruebes; tu conexión actual no cambia.</p></div>
      <a className="uiBtn uiBtnPrimary" href="/api/auth/meta/start?ads=1">Dar permiso de anuncios</a>
    </section>:!accounts.length?<section className="calPanel adsConnect"><div className="adsConnectIcon"><AlertTriangle size={20}/></div><div><h2>No encontramos cuentas publicitarias</h2><p>Crea una cuenta publicitaria en tu Business Manager, agrégale un método de pago y vuelve a cargar esta página.</p></div><button type="button" className="uiBtn uiBtnSecondary" onClick={()=>void loadAccounts()}><RefreshCw size={16}/> Volver a cargar</button></section>:<>

    <div className="calStats adsStats" role="list" aria-label="Resumen de anuncios">
      <div className="calStat" role="listitem"><span>Gasto</span><strong>{totals?money(totals.spend):"—"}</strong></div>
      <div className="calStat" role="listitem"><span>Me gusta ganados</span><strong>{totals?totals.likes.toLocaleString("es-MX"):"—"}</strong></div>
      <div className="calStat" role="listitem"><span>Costo por Me gusta</span><strong>{totals?.costPerLike!=null?money(totals.costPerLike):"—"}</strong></div>
      <div className="calStat" role="listitem"><span>Tope diario</span><strong>{money(cap)}</strong></div>
    </div>

    <div className="adsGrid">
      <section className="calPanel">
        <div className="adsHead"><div><h2>Nueva campaña</h2><p>Promociona una publicación con el botón Me gusta de la página.</p></div><span className="statusPill tone-neutral"><PauseCircle size={13}/> Se crea en pausa</span></div>
        <div className="adsForm">
          <label className="field"><span>Cuenta publicitaria</span><select value={accountId} onChange={e=>chooseAccount(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id} disabled={!a.active}>{a.name} · {a.currency}{a.active?"":" · inactiva"}</option>)}</select></label>
          <label className="field"><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)}><option value="">Elige una página</option>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="field"><span>Publicación del anuncio <small>ordenadas por interacción</small></span>
            {postsLoading?<div className="adsPostsEmpty"><Loader2 className="spin" size={16}/> Cargando publicaciones…</div>:posts.length?<div className="adsPosts">{posts.slice(0,12).map(p=><button type="button" key={p.id} className={postId===p.id?"active":""} onClick={()=>setPostId(p.id)} aria-pressed={postId===p.id}>{p.picture?<img src={p.picture} alt="" loading="lazy"/>:<span className="adsPostText">{p.message.slice(0,90)||"Publicación"}</span>}<small><Heart size={11}/> {p.reactions.toLocaleString("es-MX")} · ↗ {p.shares.toLocaleString("es-MX")}</small></button>)}</div>:<div className="adsPostsEmpty">{pageId?"No hay publicaciones recientes en esta página.":"Elige una página."}</div>}
          </div>
          <label className="field"><span>Nombre de la campaña</span><input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
          <div className="fieldRow">
            <label className="field"><span>Presupuesto diario ({currency})</span><input type="number" min={1} max={cap} step={1} value={dailyBudget} onChange={e=>setDailyBudget(Number(e.target.value))}/></label>
            <label className="field"><span>Duración</span><select value={days} onChange={e=>setDays(Number(e.target.value))}>{[3,5,7,10,14,21,30].map(n=><option key={n} value={n}>{n} días</option>)}</select></label>
          </div>
          <div className="fieldRow">
            <label className="field"><span>Edad mínima</span><input type="number" min={18} max={65} value={ageMin} onChange={e=>setAgeMin(Number(e.target.value))}/></label>
            <label className="field"><span>Edad máxima</span><input type="number" min={18} max={65} value={ageMax} onChange={e=>setAgeMax(Number(e.target.value))}/></label>
          </div>
          <div className="field"><span>Países <small>{countries.length} elegidos</small></span><div className="adsCountries">{COUNTRIES.map(([code,label])=><button type="button" key={code} className={countries.includes(code)?"active":""} onClick={()=>toggleCountry(code)} aria-pressed={countries.includes(code)}>{label}</button>)}</div></div>
        </div>
        {budgetError&&<div className="scheduleValidity warn"><AlertTriangle size={16}/><span>{budgetError}</span></div>}
        <div className="adsSummary"><ShieldCheck size={16}/><span>Gasto máximo si la activas: <b>{money(totalMax)}</b> ({money(dailyBudget)} × {days} días). Meta cobra a tu método de pago solo cuando la campaña está activa.</span></div>
        {error&&<div className="quickNotice error"><AlertTriangle size={16}/><span>{error}</span></div>}
        {notice&&<div className="quickNotice"><Info size={16}/><span>{notice.text} {notice.url&&<a href={notice.url} target="_blank" rel="noreferrer">Abrir en el Administrador de anuncios</a>}</span></div>}
        <div className="actionBar"><button type="button" className="uiBtn uiBtnPrimary" onClick={()=>void create()} disabled={!canCreate||creating}>{creating?<Loader2 className="spin" size={16}/>:<Megaphone size={16}/>} Crear campaña en pausa</button></div>
      </section>

      <section className="calPanel">
        <div className="adsHead"><div><h2>Resultados</h2><p>Gasto, Me gusta y costo por Me gusta de cada campaña.</p></div><div className="adsHeadActions"><select aria-label="Periodo" value={preset} onChange={e=>setPreset(e.target.value)}>{PRESETS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button type="button" className="uiIconBtn" onClick={()=>void loadResults()} aria-label="Actualizar resultados" disabled={resultsLoading}>{resultsLoading?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>}</button></div></div>
        {likeResults.length?<div className="adsTable" role="table" aria-label="Resultados por campaña">
          <div className="adsRow head" role="row"><span role="columnheader">Campaña</span><span role="columnheader">Gasto</span><span role="columnheader">Me gusta</span><span role="columnheader">Costo por Me gusta</span></div>
          {likeResults.map(r=>{const [label,tone]=STATUS[r.status]||[r.status||"—","neutral"];return <div className="adsRow" role="row" key={r.id}>
            <span role="cell" className="adsName"><a href={r.url} target="_blank" rel="noreferrer">{r.name}</a><small className={`statusPill tone-${tone}`}>{label}</small></span>
            <span role="cell">{money(r.spend)}</span><span role="cell">{r.likes.toLocaleString("es-MX")}</span><span role="cell"><b>{r.costPerLike!=null?money(r.costPerLike):"—"}</b></span>
          </div>})}
        </div>:<div className="adsEmpty"><Megaphone size={18}/><span>{resultsLoading?"Cargando resultados…":"Todavía no hay campañas de interacción en esta cuenta."}</span></div>}
      </section>
    </div>
    </>}
  </div>;
}
