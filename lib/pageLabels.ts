/** Etiquetas sin inventar métricas: followers_count = seguidores; fan_count = fans/Me gusta. */
export type LabelledPage = {id:string;name:string;followers_count?:number|null;fan_count?:number|null};
export function formatPageLabel(page:LabelledPage){
  const followers = typeof page.followers_count === "number" ? page.followers_count : null;
  const fans = typeof page.fan_count === "number" ? page.fan_count : null;
  const count = followers !== null ? `${new Intl.NumberFormat("es-MX").format(followers)} seguidores`
    : fans !== null ? `${new Intl.NumberFormat("es-MX").format(fans)} Me gusta` : "métrica no disponible";
  const id = String(page.id || "");
  return `${page.name} · ${count} · ID …${id.slice(-6)}`;
}
