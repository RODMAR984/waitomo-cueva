// utils/getRandomGeneralImage.js
// Helper opcional (inutilizado por defecto) para obtener una imagen general aleatoria.
// - Si no hay imágenes registradas, retorna null (seguro).
// - Podés registrar imágenes en cualquier punto del app con registerGeneralImages([...]).
// - Acepta 'seed' opcional para determinismo (útil en pruebas).
// - Compatible con RN: admite require('...') y { uri: '...' }.

// Registro en memoria (evita dependencias circulares y es tree-shakeable)
const generalImages = [];

/**
 * Reemplaza completamente el pool de imágenes generales.
 * Acepta entradas tipo `require('...')` o `{ uri: '...' }`.
 * @param {Array<any>} list
 */
export function registerGeneralImages(list) {
  generalImages.length = 0;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item) generalImages.push(item);
    }
  }
}

/**
 * Agrega imágenes al pool sin borrar las existentes.
 * @param {Array<any>} list
 */
export function appendGeneralImages(list) {
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item) generalImages.push(item);
    }
  }
}

/**
 * Pequeño hash determinista para seeds (string/number) -> 32-bit entero.
 * @param {string|number} seed
 * @returns {number}
 */
function hashSeed(seed) {
  const s = String(seed ?? '');
  let h = 2166136261; // FNV-1a base
  // eslint-disable-next-line no-bitwise
  for (let i = 0; i < s.length; i += 1) h = (h ^ s.charCodeAt(i)) * 16777619;
  // eslint-disable-next-line no-bitwise
  return (h >>> 0);
}

/**
 * Devuelve una imagen general aleatoria del pool actual.
 * Si no hay imágenes registradas, retorna null (fallback seguro).
 * @param {object} [opts]
 * @param {string|number} [opts.seed]  Si se pasa, la elección es determinista.
 * @returns {any|null}
 */
export default function getRandomGeneralImage(opts = {}) {
  const total = generalImages.length;
  if (!total) return null;

  const { seed } = opts;
  let index;

  if (seed !== undefined && seed !== null) {
    const h = hashSeed(seed);
    index = h % total;
  } else {
    index = Math.floor(Math.random() * total);
  }

  return generalImages[index] || null;
}

/* --------------------------------------------
   Ejemplo de uso (si algún día quisieras usarlo):

   // En un setup o en la propia screen:
   import getRandomGeneralImage, { registerGeneralImages } from '../utils/getRandomGeneralImage';

   registerGeneralImages([
     require('../assets/backgrounds/waitomo_01.jpg'),
     require('../assets/backgrounds/waitomo_02.jpg'),
     { uri: 'https://...' },
   ]);

   const img = getRandomGeneralImage({ seed: Date.now() }); // o sin seed
   // Pasarlo a <ImageBackground source={img} ... />
--------------------------------------------- */
