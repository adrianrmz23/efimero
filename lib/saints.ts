// Iconografía tradicional de los santos más pedidos, en inglés para los modelos de imagen.
// Sirve para que el santo salga reconocible (sus símbolos) en las escenas donde aparece.
export const SAINT_ICONOGRAPHY: Array<{ names: string[]; label: string; look: string }> = [
  { names: ["judas tadeo", "san judas"], label: "San Judas Tadeo", look: "Saint Jude Thaddeus: bearded apostle with long brown hair and beard, green tunic with white robe, a round gold medallion with the face of Jesus on his chest, a small flame above his head, holding a wooden staff, gentle halo" },
  { names: ["ignacio de loyola", "san ignacio"], label: "San Ignacio de Loyola", look: "Saint Ignatius of Loyola: bald man with short dark beard, black Jesuit cassock, holding a book with the IHS monogram, gentle halo" },
  { names: ["san benito", "benito abad"], label: "San Benito", look: "Saint Benedict: elderly monk with white beard and tonsure, black Benedictine habit, holding the Saint Benedict cross and a book, a black raven nearby, gentle halo" },
  { names: ["san miguel", "miguel arcangel", "miguel arcángel"], label: "San Miguel Arcángel", look: "Saint Michael the Archangel: young angel with large white wings, golden Roman armor, red cape, raised sword of light, radiant halo" },
  { names: ["guadalupe"], label: "Virgen de Guadalupe", look: "Our Lady of Guadalupe: young woman with brown skin and gentle face, hands joined in prayer, turquoise mantle covered with gold stars, rose-colored gown with floral pattern, surrounded by golden rays, standing on a crescent moon held by an angel" },
  { names: ["san jose", "san josé"], label: "San José", look: "Saint Joseph: middle-aged bearded carpenter with brown hair, brown and green robes, holding a white lily, sometimes carrying the child Jesus, gentle halo" },
  { names: ["san antonio"], label: "San Antonio de Padua", look: "Saint Anthony of Padua: young Franciscan friar with tonsure, brown habit with white cord, holding the child Jesus and a white lily, gentle halo" },
  { names: ["martin de porres", "martín de porres"], label: "San Martín de Porres", look: "Saint Martin de Porres: Afro-Peruvian Dominican friar with short black curly hair, white tunic with black cape, holding a broom and a cross, gentle halo" },
  { names: ["santa rita"], label: "Santa Rita de Casia", look: "Saint Rita of Cascia: nun in black habit and white wimple, a small wound on her forehead, holding a crucifix and roses, gentle halo" },
  { names: ["charbel", "chárbel"], label: "San Charbel", look: "Saint Charbel: Maronite monk with long white beard, black hooded habit, eyes lowered in prayer, gentle halo" },
  { names: ["toribio romo"], label: "Santo Toribio Romo", look: "Saint Toribio Romo: young Mexican priest with short dark hair and kind face, black cassock with white collar, gentle halo" },
  { names: ["san francisco", "francisco de asis", "francisco de asís"], label: "San Francisco de Asís", look: "Saint Francis of Assisi: friar with short beard and tonsure, brown habit with rope belt, birds around him, gentle halo" },
  { names: ["sagrado corazon", "sagrado corazón", "jesus", "jesús"], label: "Jesús", look: "Jesus Christ: gentle bearded man with long brown hair, white tunic and red mantle, a glowing Sacred Heart on his chest, warm radiant light" },
  { names: ["carlo acutis"], label: "San Carlo Acutis", look: "Saint Carlo Acutis: Italian teenage boy with short dark wavy hair, kind smile, blue sweatshirt and jeans, soft light around him" },
  { names: ["jose gregorio", "josé gregorio"], label: "San José Gregorio Hernández", look: "Saint José Gregorio Hernández: slim Venezuelan doctor with thin mustache, black suit and black hat, white shirt, hands behind his back, gentle light" },
  { names: ["juan diego"], label: "San Juan Diego", look: "Saint Juan Diego: Indigenous Mexican man with short black hair, white cotton clothes and a tilma cloak, gentle halo" },
];

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Busca el santo mencionado en el tema (el primero que aparezca).
export function findSaint(topic: string) {
  const text = normalize(topic);
  return SAINT_ICONOGRAPHY.find(s => s.names.some(n => text.includes(normalize(n)))) || null;
}
