// Recorrido de una casa: espacios en orden, con su texto en pantalla, cómo se genera la imagen y cómo se mueve la cámara.
export type RoomPreset = { id: string; label: string; scene: string; motion: string };

export const DEFAULT_HOUSE_STYLE = "Modern narrow house in Latin America, 6 meters wide. White smooth walls, walnut wood slat accents, matte black details, large polished light-gray porcelain floor tiles, warm LED strip lighting in drywall ceiling coves, recessed warm downlights, white marble with subtle gray veins, beige fabrics, indoor plants.";

export const ROOM_PRESETS: RoomPreset[] = [
  { id: "fachada", label: "Fachada", scene: "Front facade of the house seen from the street at golden hour, black pivot front door with long vertical handle, walnut slat panel, large black-framed window, stone planter with tropical plants and uplights.", motion: "The camera slowly dollies forward toward the front door, which swings open revealing the warm interior." },
  { id: "entrada", label: "Recibidor", scene: "Interior view from the open front door into a bright entrance hall with a slim walnut console, a round mirror and a plant, the living room visible ahead.", motion: "The camera glides forward smoothly down the entrance hall toward the living room." },
  { id: "sala", label: "Sala", scene: "Living room with a TV wall of white marble framed by walnut wood slats, a floating TV shelf with hidden LED light, a beige L-shaped sofa and a round coffee table.", motion: "The camera slowly moves forward and pans gently across the living room toward the TV wall." },
  { id: "comedor", label: "Comedor y cocina", scene: "Open dining area with a wooden table and black chairs, and behind it a white and walnut kitchen with an island and black pendant lights.", motion: "The camera glides forward past the dining table toward the kitchen." },
  { id: "cocina", label: "Cocina", scene: "Kitchen island in white marble with walnut base, beige bar stools, black pendant lights, built-in black oven and black refrigerator, warm LED under the upper cabinets.", motion: "The camera slowly orbits around the kitchen island." },
  { id: "escalera", label: "Escalera", scene: "Floating staircase with walnut steps and warm LED light under each step, glass railing, a vertical walnut slat wall beside it.", motion: "The camera slowly rises up following the floating staircase." },
  { id: "recamara", label: "Recámara", scene: "Master bedroom with an upholstered beige bed against a walnut slat headboard wall with warm LED backlight, white bedding, black bedside lamps, large window with sheer curtains.", motion: "The camera slowly dollies into the bedroom toward the bed." },
  { id: "bano", label: "Baño", scene: "Bathroom with a floating walnut vanity, white marble countertop and vessel sink, backlit round mirror, walk-in shower with clear glass, black fixtures.", motion: "The camera slowly glides forward into the bathroom toward the vanity and mirror." },
  { id: "patio", label: "Patio", scene: "Small backyard patio at dusk with a walnut wood deck, a white wall with vertical garden and warm uplights, two lounge chairs, string lights, potted palms.", motion: "The camera slowly moves forward onto the wooden deck of the patio." },
];

export const roomImagePrompt = (room: RoomPreset, style: string) =>
  `${room.scene} Same house throughout: ${style.trim() || DEFAULT_HOUSE_STYLE} Photorealistic architectural photography, vertical 9:16, eye-level camera, wide lens, warm golden-hour light mixed with soft daylight, sharp, no people, no text, no watermark.`;

export const roomMotionPrompt = (motion: string) =>
  `${motion.trim() || "The camera glides slowly forward through the space."} Real estate walkthrough video, smooth steady gimbal camera movement, realistic, consistent architecture, no people, no text.`;
