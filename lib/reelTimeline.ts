// Línea de tiempo de los reels de recorrido: qué escena se ve en cada instante y cómo se mueve la cámara.
export type SceneFrame = { index: number; progress: number; next: number | null; mix: number };

// Cada escena dura lo indicado; durante los últimos `fade` segundos se mezcla con la siguiente.
export function sceneAt(t: number, durations: number[], fade: number): SceneFrame {
  let start = 0;
  for (let i = 0; i < durations.length; i++) {
    const end = start + durations[i];
    if (t < end || i === durations.length - 1) {
      const local = Math.max(0, Math.min(durations[i], t - start));
      const fadeStart = durations[i] - fade;
      const hasNext = i < durations.length - 1;
      const mix = hasNext && local > fadeStart ? Math.min(1, (local - fadeStart) / fade) : 0;
      return { index: i, progress: durations[i] ? local / durations[i] : 1, next: hasNext ? i + 1 : null, mix };
    }
    start = end;
  }
  return { index: 0, progress: 0, next: null, mix: 0 };
}

export const totalDuration = (durations: number[]) => durations.reduce((sum, d) => sum + d, 0);

// Movimiento suave tipo "Ken Burns": acercamiento lento y paneo que alterna de lado en cada escena.
export function kenBurns(progress: number, index: number) {
  const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  const zoomIn = index % 3 !== 2;
  const scale = zoomIn ? 1 + .12 * eased : 1.12 - .12 * eased;
  const direction = index % 2 === 0 ? 1 : -1;
  return { scale, dx: direction * (eased - .5) * .06, dy: (eased - .5) * -.02 };
}
