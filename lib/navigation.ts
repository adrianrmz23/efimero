import { BarChart3, CalendarDays, Film, House, Library, Megaphone, Radar, Send, Settings2, Sparkles, type LucideIcon } from "lucide-react";

// Cada sección del sidebar agrupa varias pantallas existentes como pestañas internas.
export type NavTab = { tab:string; label:string };
export type NavSection = { id:string; label:string; icon:LucideIcon; tabs:NavTab[] };
export type NavGroup = { label?:string; sections:NavSection[] };

export const navGroups:NavGroup[] = [
  { sections:[{ id:"home", label:"Inicio", icon:House, tabs:[{tab:"home",label:"Inicio"}] }] },
  { label:"Crear", sections:[
    { id:"studio", label:"Estudio", icon:Sparkles, tabs:[{tab:"creator",label:"Post rápido"},{tab:"factory",label:"Fábrica de textos"},{tab:"experiments",label:"Experimentos"},{tab:"creativeStudio",label:"Estudio creativo"}] },
    { id:"inspiration", label:"Inspiración", icon:Radar, tabs:[{tab:"radar",label:"Radar"},{tab:"niches",label:"Laboratorio de nichos"},{tab:"learningAgent",label:"Learning Agent"}] },
    { id:"reels", label:"Reels", icon:Film, tabs:[{tab:"reelStudio",label:"Estudio de reels"},{tab:"reels",label:"Gestor de Reels"}] },
  ]},
  { label:"Publicar", sections:[
    { id:"calendar", label:"Calendario", icon:CalendarDays, tabs:[{tab:"calendar",label:"Calendario"},{tab:"queue",label:"Bandeja de revisión"},{tab:"metaQueue",label:"Cola de Meta"}] },
    { id:"schedule", label:"Programar", icon:Send, tabs:[{tab:"publisher",label:"Un post"},{tab:"bulkTexts",label:"Textos en bulk"},{tab:"bulkImages",label:"Imágenes en bulk"}] },
    { id:"ads", label:"Anuncios", icon:Megaphone, tabs:[{tab:"ads",label:"Me gusta de la página"}] },
  ]},
  { label:"Analizar", sections:[
    { id:"performance", label:"Rendimiento", icon:BarChart3, tabs:[{tab:"analytics",label:"Resultados"},{tab:"executive",label:"Resumen"},{tab:"learning",label:"Aprendizaje"},{tab:"weekly",label:"Reporte semanal"}] },
    { id:"library", label:"Biblioteca", icon:Library, tabs:[{tab:"library",label:"Biblioteca"},{tab:"profile",label:"Huella editorial"},{tab:"categories",label:"Categorías"}] },
  ]},
];

export const settingsSection:NavSection = { id:"settings", label:"Ajustes", icon:Settings2, tabs:[{tab:"control",label:"Centro de control"}] };

const allSections = [...navGroups.flatMap(g=>g.sections), settingsSection];

// Las herramientas técnicas que no viven en ninguna sección caen en Ajustes.
export function sectionForTab(tab:string):NavSection{
  return allSections.find(s=>s.tabs.some(t=>t.tab===tab)) || settingsSection;
}
