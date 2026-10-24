// Ideas listas para reels de "transformación": cómo se ve el espacio antes y qué pasa en el video.
export type TransformPreset = { id: string; label: string; before: string; motion: string };

export const TRANSFORM_PRESETS: TransformPreset[] = [
  { id: "tvwall", label: "Muro de TV", before: "the same room but the TV wall is a plain unfinished white wall, no panels, no TV, no furniture, no decorative lights, construction tools on the floor", motion: "two workers measure the wall and install marble panels, wooden slats, a floating shelf, the TV and warm LED strip lights" },
  { id: "kitchen", label: "Cocina", before: "the same space as an empty unfinished kitchen area with bare concrete walls, exposed pipes, no cabinets, no countertop, no appliances", motion: "workers install cabinets, the countertop, backsplash, appliances and pendant lights" },
  { id: "facade", label: "Fachada", before: "the same house facade unfinished: raw gray concrete blocks, no paint, no wood cladding, no lights, no plants, dirt on the ground", motion: "workers plaster and paint the facade, add wood cladding, install the door, windows, lights and plant the garden" },
  { id: "bathroom", label: "Baño", before: "the same bathroom unfinished: bare cement walls and floor, exposed pipes, no tiles, no fixtures, no mirror", motion: "workers lay the tiles, install the vanity, mirror, shower glass and lights" },
  { id: "ceiling", label: "Plafón LED", before: "the same room with a plain flat white ceiling, no recessed lights, no LED strips, empty room", motion: "workers build a drywall ceiling with recessed lights and turn on warm LED strip lighting" },
  { id: "patio", label: "Patio", before: "the same backyard empty: bare dirt, plain unpainted walls, no deck, no plants, no furniture, no lights", motion: "workers build a wooden deck, plant a garden, add outdoor furniture and warm lights" },
];

export const transformPrompt = (preset: TransformPreset | undefined, extra: string) =>
  [`Fast time-lapse renovation video, static camera, realistic. ${preset ? `${preset.motion}.` : "Workers transform the space from the first frame into the finished design of the last frame."}`, extra.trim(), "Smooth motion, consistent architecture, no text, no watermark."].filter(Boolean).join(" ");

export const beforePrompt = (preset: TransformPreset | undefined, extra: string) =>
  [`Turn this finished interior or exterior into its state before the renovation. Keep exactly the same camera angle, perspective, room size and architecture. Show ${preset?.before || "the same space unfinished and empty"}.`, extra.trim(), "Photorealistic."].filter(Boolean).join(" ");

export const estimateCost = (seconds: number, pricePerSecond: number) => Math.round(seconds * pricePerSecond * 100) / 100;
