"use client";

import { useState } from "react";
import OperationsCenter from "@/components/OperationsCenter";
import ProductionReadiness from "@/components/ProductionReadiness";
import QualityCenter from "@/components/QualityCenter";

// Reúne en una pantalla lo que antes eran Operaciones, Producción y QA final.
type View = "operations"|"production"|"quality";
const views:{id:View;label:string}[] = [
  {id:"operations",label:"Servicios"},
  {id:"production",label:"Producción"},
  {id:"quality",label:"Auditoría"},
];

export default function SystemHealth({schedule,library}:{schedule:any[];library:any[]}){
  const [view,setView]=useState<View>("operations");
  return <div className="systemHealth">
    <div className="segmented compact systemHealthSwitch" role="tablist" aria-label="Estado del sistema">
      {views.map(v=><button key={v.id} type="button" role="tab" aria-selected={view===v.id} className={view===v.id?"active":""} onClick={()=>setView(v.id)}>{v.label}</button>)}
    </div>
    {view==="operations"&&<OperationsCenter schedule={schedule} library={library}/>}
    {view==="production"&&<ProductionReadiness/>}
    {view==="quality"&&<QualityCenter/>}
  </div>;
}
