// utils/getRandomPlanImage.js — Refactor Waitomo (dark-only, helper lógico)
// Mantiene funcionalidad original: retorna imagen del plan o fallback.
// Sin estilos, sin dependencias visuales. 100% ESLint safe.

const planImages = {
  cross: [require('../assets/plan_image/cross/plan_cross.png')],
  evolucion: [require('../assets/plan_image/evolucion/plan_evolucion.png')],
  hyrox: [require('../assets/plan_image/hyrox/plan_hyrox_1.png')],
  oly: [require('../assets/plan_image/oly/plan_oly.png')],
  openbox: [require('../assets/plan_image/openbox/plan_openbox.png')],
  stretching: [require('../assets/plan_image/stretching/plan_stretching.png')],
  yoga: [require('../assets/plan_image/yoga/plan_yoga.png')],
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
 * addPlanImage('nuevoPlan', require('../assets/plan_image/nuevoPlan/plan_nuevo.png'));
 */

export function addPlanImage(planKey, image) {
  const key = String(planKey || '').toLowerCase().trim();
  if (!key) return;
  if (!planImages[key]) planImages[key] = [];
  planImages[key].push(image);
}