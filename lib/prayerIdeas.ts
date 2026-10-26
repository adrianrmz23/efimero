// Ideas de oraciones y salmos para shorts: la IA propone temas a partir de la fecha (fiestas y santos cercanos)
// y, si hay datos, de los shorts de oración con más vistas del último mes en YouTube.
export type ShortTrend = { title: string; channel: string; views: number; publishedAt: string; url: string };
export type PrayerIdea = { topic: string; kind: "prayer" | "psalm"; hook: string; why: string };

export function ideasPrompt(input: { today: string; kind: "prayer" | "psalm" | "any"; trends: ShortTrend[]; recent: string[] }) {
  const trends = input.trends.length
    ? `Shorts de oración más vistos en español del último mes (título · vistas):\n${input.trends.map(t => `- ${t.title} · ${t.views.toLocaleString("es-MX")}`).join("\n")}\nUsa estos datos para detectar qué necesidades y devociones están funcionando (no copies los títulos).`
    : "No hay datos de tendencias: apóyate en las necesidades que más se rezan en Latinoamérica.";
  return `Hoy es ${input.today}. Propón 6 ideas para shorts ${input.kind === "psalm" ? "de salmos" : input.kind === "prayer" ? "de oraciones" : "de oraciones y salmos"} católicos en español latino.
${trends}
- Considera las fiestas, santos y tiempos litúrgicos de las próximas 2 semanas (si alguna aplica, que al menos una idea la aproveche).
- Mezcla necesidades concretas: hijos, salud, trabajo, dinero para las deudas, matrimonio, ansiedad, duelo, protección, agradecimiento.
- Cada idea debe ser distinta y específica (no "oración por la paz" genérica).${input.recent.length ? `\n- Evita repetir estos temas recientes: ${input.recent.join("; ")}.` : ""}
- Sin promesas de milagros garantizados ni de dinero seguro.
Devuelve solo JSON: {"ideas":[{"topic":"tema listo para escribir la oración, por ejemplo: Oración a San Judas Tadeo por un trabajo estable","kind":"prayer o psalm","hook":"frase gancho de apertura","why":"por qué puede funcionar ahora, en una línea"}]}`;
}

export function parseIdeas(raw: string): PrayerIdea[] {
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("El modelo no devolvió ideas en el formato esperado.");
  const d = JSON.parse(raw.slice(start, end + 1));
  return (Array.isArray(d.ideas) ? d.ideas : []).map((x: any) => ({
    topic: String(x?.topic || "").trim().slice(0, 200), kind: x?.kind === "psalm" ? "psalm" as const : "prayer" as const,
    hook: String(x?.hook || "").trim().slice(0, 200), why: String(x?.why || "").trim().slice(0, 240),
  })).filter((x: PrayerIdea) => x.topic).slice(0, 8);
}

// Junta los resultados de búsqueda con sus vistas y deja los más vistos, sin repetir.
export function rankTrends(items: Array<{ id: string; title: string; channel: string; publishedAt: string }>, views: Record<string, number>, limit = 15): ShortTrend[] {
  const seen = new Set<string>();
  return items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
    .map(i => ({ title: i.title, channel: i.channel, publishedAt: i.publishedAt, views: views[i.id] || 0, url: `https://youtube.com/shorts/${i.id}` }))
    .sort((a, b) => b.views - a.views).slice(0, limit);
}
