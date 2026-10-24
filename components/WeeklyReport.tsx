"use client";

import { formatPageLabel } from "@/lib/pageLabels";

import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Clipboard, FileText, Info, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { usePages } from "@/lib/pagesContext";

export default function WeeklyReport(){
  const {pages,activePageId}=usePages();
  // Selección local: elegir otra página aquí no cambia la página activa global.
  const [localPageId,setPageId]=useState("");
  const pageId=localPageId&&pages.some(p=>p.id===localPageId)?localPageId:activePageId;
  const [items,setItems]=useState<any[]>([]);const [current,setCurrent]=useState<any>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  useEffect(()=>{void bootstrap()},[]);
  async function bootstrap(){try{const rr=await fetch("/api/reports/weekly",{cache:"no-store"});const rd=await rr.json();setItems(rd.items||[]);if(rd.items?.length)setCurrent(rd.items[0])}catch{}}
  async function generate(){setBusy(true);setMessage("");try{const r=await fetch("/api/reports/weekly",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo generar el reporte.");const normalized={id:d.id,created_at:d.createdAt,page_id:d.context?.pageId,page_name:d.context?.pageName,metrics:d.context,report:d.report};setCurrent(normalized);setItems(c=>[normalized,...c].slice(0,8));setMessage("Reporte semanal actualizado.")}catch(e:any){setMessage(e?.message||"Falló el reporte.")}finally{setBusy(false)}}
  async function copy(){if(!current)return;const r=current.report||{};const text=`REPORTE SEMANAL · ${current.page_name||"Efímero"}\n\n${r.summary||""}\n\nQUÉ FUNCIONÓ\n${(r.wins||[]).map((x:string)=>`- ${x}`).join("\n")}\n\nRIESGOS\n${(r.risks||[]).map((x:string)=>`- ${x}`).join("\n")}\n\nSIGUIENTE SEMANA\n${(r.nextWeek||[]).map((x:string)=>`- ${x}`).join("\n")}\n\n${r.note||""}`;await navigator.clipboard.writeText(text);setMessage("Reporte copiado al portapapeles.")}
  const report=current?.report||{};const metrics=current?.metrics||{};
  return <>
    <div className="pageIntro"><div><span className="overline">INTELIGENCIA</span><h1>Reporte semanal</h1><p>Qué aprendimos esta semana: desempeño observado, experimentos, fatiga y siguientes pruebas. Nunca convierte una muestra en una promesa de rendimiento.</p></div><div className="setIntroActions"><button className="uiBtn uiBtnSecondary" onClick={copy} disabled={!current}><Clipboard size={16}/> Copiar</button><button className="uiBtn uiBtnPrimary" onClick={generate} disabled={busy||!pageId}>{busy?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Generar reporte</button></div></div>
    <div className="setStack">
      <section className="setCard setToolbar">
        <label className="setField"><span>Página</span><select value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option value={p.id} key={p.id}>{formatPageLabel(p)}</option>)}</select></label>
        {items.length>0&&<div className="setField"><span className="setFieldLabel">Reportes anteriores</span><div className="segmented compact">{items.slice(0,5).map((x:any)=><button type="button" className={current?.id===x.id?"active":""} key={x.id} onClick={()=>setCurrent(x)}>{new Date(x.created_at).toLocaleDateString("es-MX")}</button>)}</div></div>}
      </section>
      {message&&<div className="setNotice"><Info size={16}/><span>{message}</span></div>}
      {current?<>
        <div className="setKpis">
          <div className="setKpi"><span>Publicados</span><strong>{metrics.published||0}</strong><small>Últimos 7 días</small></div>
          <div className="setKpi"><span>Compartidos</span><strong>{metrics.metrics?.shares||0}</strong><small>Último snapshot por post</small></div>
          <div className="setKpi"><span>Comentarios</span><strong>{metrics.metrics?.comments||0}</strong><small>Último snapshot por post</small></div>
          <div className="setKpi"><span>Compliance PASS</span><strong>{Math.round(Number(metrics.compliance?.passRate??1)*100)}%</strong><small>{metrics.compliance?.reviews||0} revisiones</small></div>
        </div>
        <section className="setCard">
          <div><span className="overline">RESUMEN DIRECTIVO</span></div>
          <p className="setLead">{report.summary}</p>
          {report.note&&<p className="setRowNote">{report.note}</p>}
        </section>
        <div className="setSplit even">
          <ReportSection icon={<CheckCircle2 size={18}/>} title="Qué funcionó" items={report.wins}/>
          <ReportSection icon={<TriangleAlert size={18}/>} title="Riesgos y fatiga" items={report.risks}/>
          <ReportSection icon={<BarChart3 size={18}/>} title="Experimentos" items={report.experiments}/>
          <ReportSection icon={<Sparkles size={18}/>} title="Qué probar después" items={report.nextWeek}/>
        </div>
      </>:<section className="setCard"><div className="setEmpty"><FileText size={24}/><strong>Aún no hay reporte semanal</strong><span>Genera el primero cuando ya tengas publicaciones y snapshots de rendimiento.</span></div></section>}
    </div>
  </>;
}
function ReportSection({icon,title,items=[]}:{icon:any;title:string;items?:string[]}){return <section className="setCard"><div className="setCardTitle">{icon}<div><h2>{title}</h2></div></div>{items?.length?<ol className="setList">{(items||[]).map((x,i)=><li key={i}><span className="setIndex">{i+1}</span>{x}</li>)}</ol>:<div className="setEmpty inset"><span>Sin señales suficientes en esta sección.</span></div>}</section>}
