"use client";

import { Activity, BarChart3, Bot, BrainCircuit, CalendarDays, Database, Fingerprint, FlaskConical, Gauge, Image as ImageIcon, Layers3, MessagesSquare, RadioTower, Settings2, ShieldCheck, Sparkles, TrendingUp, FileText } from "lucide-react";

type Props={onNavigate:(tab:string)=>void};
type Tool={tab:string;title:string;description:string;icon:any;tag?:string};

const groups:{title:string;description:string;tools:Tool[]}[]=[
  {title:"Inteligencia editorial",description:"Herramientas de análisis que no necesitas tener siempre a la vista.",tools:[
    {tab:"profile",title:"Huella editorial",description:"Patrones históricos y voz propia de la página.",icon:Fingerprint},
    {tab:"learning",title:"Aprendizaje",description:"Qué está funcionando en tu contenido propio.",icon:BrainCircuit},
    {tab:"experiments",title:"Experimentos",description:"Variantes y pruebas de copy.",icon:FlaskConical},
    {tab:"audience",title:"Audiencia",description:"Señales extraídas de comentarios y conversación.",icon:MessagesSquare},
    {tab:"fatigue",title:"Fatiga",description:"Detecta repetición de temas, hooks y categorías.",icon:Gauge},
    {tab:"score",title:"Scoring",description:"Compatibilidad editorial explicable de cada texto.",icon:BarChart3},
    {tab:"weekly",title:"Reporte semanal",description:"Resumen de rendimiento y próximos experimentos.",icon:FileText},
  ]},
  {title:"Automatización",description:"Motores que sostienen el flujo diario de Efímero.",tools:[
    {tab:"autopilot",title:"Autopilot",description:"Reglas automáticas de producción.",icon:Sparkles},
    {tab:"agent",title:"Agente editorial",description:"Detecta huecos y propone contenido.",icon:Bot},
    {tab:"scheduler",title:"Scheduler",description:"Publicación programada y reintentos.",icon:CalendarDays},
    {tab:"loop",title:"Ciclo vivo",description:"Recuperación automática de métricas post-publicación.",icon:TrendingUp},
    {tab:"dataset",title:"Dataset",description:"Índice semántico de tu memoria editorial.",icon:Database},
  ]},
  {title:"Facebook y políticas",description:"Conexión de Meta y controles antes de publicar.",tools:[
    {tab:"meta",title:"Meta Connector",description:"Páginas administradas, OAuth e importación propia.",icon:RadioTower},
    {tab:"compliance",title:"Compliance",description:"Revisión de políticas antes de aprobar copies.",icon:ShieldCheck},
  ]},
  {title:"Administración",description:"Configuración, salud del sistema y mantenimiento.",tools:[
    {tab:"categories",title:"Categorías",description:"Líneas editoriales disponibles para generación.",icon:Layers3},
    {tab:"images",title:"Imágenes",description:"Motor visual secundario.",icon:ImageIcon},
    {tab:"production",title:"Producción",description:"Estado de servicios y readiness.",icon:ShieldCheck},
    {tab:"operations",title:"Operaciones",description:"Contadores y diagnóstico operativo.",icon:Activity},
    {tab:"quality",title:"QA final",description:"Auditoría de configuración y puntos críticos.",icon:Settings2},
  ]},
];

export default function ControlCenter({onNavigate}:Props){
  return <>
    <div className="pageIntro"><div><span className="overline">CENTRO DE CONTROL</span><h1>Todo lo técnico, sin llenar el menú diario</h1><p>Las funciones principales se quedan en el sidebar. Aquí viven análisis avanzados, automatización, Meta y administración.</p></div><div className="controlCenterBadge"><Settings2 size={18}/><div><strong>Sistema</strong><span>{groups.reduce((n,g)=>n+g.tools.length,0)} herramientas</span></div></div></div>
    <div className="controlGroups">{groups.map(group=><section className="toolPanel controlGroup" key={group.title}><div className="panelTitle"><div><Settings2 size={19}/><div><h2>{group.title}</h2><p>{group.description}</p></div></div></div><div className="controlToolGrid">{group.tools.map(tool=>{const Icon=tool.icon;return <button className="controlToolCard" key={tool.tab} onClick={()=>onNavigate(tool.tab)}><span className="controlToolIcon"><Icon size={20}/></span><span className="controlToolCopy"><strong>{tool.title}</strong><small>{tool.description}</small></span><span className="controlArrow">→</span></button>})}</div></section>)}</div>
  </>;
}
