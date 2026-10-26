// Música de fondo generada en el navegador: acordes suaves tipo «pad» con un poco de reverberación.
// Es original (sin derechos de autor de terceros), así que no provoca reclamos de Content ID.
export type AmbientMood = "celestial" | "calm";

const NOTE = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
// Progresiones en notas MIDI (raíz, tercera, quinta y octava). Cada acorde dura `CHORD` segundos.
const PROGRESSIONS: Record<AmbientMood, number[][]> = {
  celestial: [[62, 66, 69, 74], [59, 62, 66, 71], [55, 59, 62, 67], [57, 61, 64, 69]], // Re – Si m – Sol – La
  calm: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], // Do – La m – Fa – Sol
};
const CHORD = 6;

function impulse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const data = buffer.getChannelData(c); for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3); }
  return buffer;
}

function toWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels, length = buffer.length, rate = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + length * channels * 2));
  const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(offset + i, s.charCodeAt(i)); };
  text(0, "RIFF"); out.setUint32(4, 36 + length * channels * 2, true); text(8, "WAVE"); text(12, "fmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, channels, true); out.setUint32(24, rate, true);
  out.setUint32(28, rate * channels * 2, true); out.setUint16(32, channels * 2, true); out.setUint16(34, 16, true); text(36, "data"); out.setUint32(40, length * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i++) for (let c = 0; c < channels; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true); offset += 2; }
  return new Blob([out.buffer], { type: "audio/wav" });
}

export async function renderAmbient(seconds: number, mood: AmbientMood = "celestial") {
  const rate = 44100, total = Math.ceil(seconds) + 2;
  const ctx = new OfflineAudioContext(2, rate * total, rate);
  const master = ctx.createGain(); master.gain.value = .5;
  const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1800;
  const reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx, 3.5);
  const wet = ctx.createGain(); wet.gain.value = .55;
  filter.connect(master); filter.connect(reverb).connect(wet).connect(master); master.connect(ctx.destination);
  const chords = PROGRESSIONS[mood];
  for (let start = 0, k = 0; start < total; start += CHORD, k++) {
    const chord = chords[k % chords.length];
    chord.forEach((midi, n) => {
      // Dos osciladores ligeramente desafinados por nota dan el sonido de «coro» suave.
      [-4, 4].forEach(detune => {
        const osc = ctx.createOscillator(); osc.type = n === 0 ? "sine" : "triangle"; osc.frequency.value = NOTE(n === 0 ? midi - 12 : midi); osc.detune.value = detune;
        const gain = ctx.createGain(); const peak = n === 0 ? .09 : .045;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(peak, start + 2); gain.gain.setValueAtTime(peak, start + CHORD - .5); gain.gain.linearRampToValueAtTime(0, start + CHORD + 1.5);
        osc.connect(gain).connect(filter); osc.start(start); osc.stop(start + CHORD + 1.6);
      });
    });
    // Notas altas sueltas, muy suaves, como campanitas lejanas.
    [1.5, 3.8].forEach((offset, j) => {
      const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = NOTE(chord[(k + j) % chord.length] + 12);
      const gain = ctx.createGain(); const at = start + offset;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.03, at + .05); gain.gain.exponentialRampToValueAtTime(.0001, at + 2.5);
      osc.connect(gain).connect(filter); osc.start(at); osc.stop(at + 2.6);
    });
  }
  // Entrada y salida suaves.
  master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(.5, 2); master.gain.setValueAtTime(.5, Math.max(2, seconds - 2)); master.gain.linearRampToValueAtTime(0, seconds);
  return toWav(await ctx.startRendering());
}
