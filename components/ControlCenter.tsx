"use client";

import { Activity, CalendarDays, ChevronRight, Database, RadioTower, Settings2, ShieldCheck, TrendingUp } from "lucide-react";

type Props={onNavigate:(tab:string)=>void};
type Tool={tab:string;title:string;description:string;icon:any;tag?:string};

// Solo herramientas de configuración y operación. Lo editorial vive en Estudio, Rendimiento y Biblioteca.
export const controlGroups:{title:string;description:string;tools:Tool[]}[]=[
  {title:"Facebook y políticas",description:"Conexión con Meta y controles antes de publicar.",tools:[
    {tab:"meta",title:"Conexión con Meta",description:"Páginas administradas, OAuth e importación de publicaciones.",icon:RadioTower},
    {tab:"compliance",title:"Compliance",description:"Revisión de políticas antes de aprobar textos.",icon:ShieldCheck},
  ]},
  {title:"Automatización",description:"Procesos que sostienen la publicación diaria.",tools:[
    {tab:"scheduler",title:"Publicación programada",description:"Cola automática y reintentos.",icon:CalendarDays},
    {tab:"loop",title:"Ciclo de métricas",description:"Recupera métricas después de publicar.",icon:TrendingUp},
    {tab:"dataset",title:"Memoria editorial",description:"Índice semántico de tus textos.",icon:Database},
  ]},
  {title:"Sistema",description:"Salud de los servicios y configuración.",tools:[
    {tab:"health",title:"Estado del sistema",description:"Servicios, producción y auditoría en un solo lugar.",icon:Activity},
  ]},
];

export default function ControlCenter({onNavigate}:Props){
  const total=controlGroups.reduce((n,g)=>n+g.tools.length,0);
  return <>
    <div className="pageIntro">
      <div><span className="overline">AJUSTES</span><h1>Centro de control</h1><p>Análisis avanzado, automatización, conexión con Meta y administración. Todo lo técnico, fuera del menú diario.</p></div>
      <span className="setBadge"><Settings2 size={14}/>{total} herramientas</span>
    </div>
    <div className="setGroups">
      {controlGroups.map((group,index)=><section className="setGroup" key={group.title} aria-labelledby={`set-group-${index}`}>
        <div className="setGroupHead">
          <h2 id={`set-group-${index}`}>{group.title}</h2>
          <p>{group.description}</p>
          <small>{group.tools.length} {group.tools.length===1?"herramienta":"herramientas"}</small>
        </div>
        <div className="setNavList">
          {group.tools.map(tool=>{const Icon=tool.icon;return <button type="button" className="setNavRow" key={tool.tab} onClick={()=>onNavigate(tool.tab)}>
            <span className="setIconBox"><Icon size={16}/></span>
            <span className="setNavCopy"><strong>{tool.title}</strong><small>{tool.description}</small></span>
            {tool.tag&&<span className="statusPill tone-accent">{tool.tag}</span>}
            <ChevronRight className="setNavChevron" size={16}/>
          </button>})}
        </div>
      </section>)}
    </div>
  </>;
}
