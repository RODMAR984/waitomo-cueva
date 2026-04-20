// utils/getRandomPlanImage.js — Refactor Waitomo (dark-only, helper lógico)
// Mantiene funcionalidad original: retorna imagen del plan o fallback.
// Sin estilos, sin dependencias visuales. 100% ESLint safe.

// Misma convención que utils/imagenesFijas.js (solo .jpg). Mezclar .jpg y .png con el mismo nombre base
// rompe mergeReleaseResources en Android (Duplicate resources).
const planImages = {
  cross: [require('../assets/plan_image/cross/plan_cross.jpg')],
  evolucion: [require('../assets/plan_image/evolucion/plan_evolucion.jpg')],
  hyrox: [require('../assets/plan_image/hyrox/plan_hyrox_1.jpg')],
  oly: [require('../assets/plan_image/oly/plan_oly.jpg')],
  openbox: [require('../assets/plan_image/openbox/plan_openbox.jpg')],
  stretching: [require('../assets/plan_image/stretching/plan_stretching.jpg')],
  yoga: [require('../assets/plan_image/yoga/plan_yoga.jpg')],
};

/**
 * Devuelve una imagen aleatoria asociada a un plan.
 * Si no existe el plan o no hay imágenes, retorna el fondo de bienvenida.
 * @param {string} planName - Nombre del plan (case-insensitive).
 * @returns {any} - Imagen del plan o fallback require.
 */
export default function getRandomPlanImage(planName) {
  if (!planName) {
    return require('../assets/plan_image/bg_welcome_glow.jpg');
  }

  const key = planName.toLowerCase().trim();
  
  // VERIFICACIÓN CRÍTICA: ¿existe esta clave en planImages?
  if (!planImages.hasOwnProperty(key)) {
    return require('../assets/plan_image/bg_welcome_glow.jpg');
  }

  const imgs = planImages[key];
  
  // Verificación adicional por seguridad
  if (!imgs || !Array.isArray(imgs) || imgs.length === 0) {
    return require('../assets/plan_image/bg_welcome_glow.jpg');
  }

  const idx = Math.floor(Math.random() * imgs.length);
  return imgs[idx];
}

/**
 * Si querés extender el sistema (ej. nuevos planes), podés usar:
 *
 * import { addPlanImage } from '../utils/getRandomPlanImage';
 * addPlanImage('nuevoPlan', require('../assets/plan_image/nuevoPlan/plan_nuevo.jpg'));
 */

export function addPlanImage(planKey, image) {
  const key = String(planKey || '').toLowerCase().trim();
  if (!key) return;
  if (!planImages[key]) planImages[key] = [];
  planImages[key].push(image);
}