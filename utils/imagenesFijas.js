// utils/imagenesFijas.js - CORREGIDO
// Rutas exactas según tu estructura de carpetas

// utils/imagenesFijas.js - CON JPEG
export const IMAGENES_POR_PLAN = {
  cross: require('../assets/plan_image/cross/plan_cross.jpg'),
  openbox: require('../assets/plan_image/openbox/plan_openbox.jpg'),
  evolucion: require('../assets/plan_image/evolucion/plan_evolucion.jpg'),
  stretching: require('../assets/plan_image/stretching/plan_stretching.jpg'),
  yoga: require('../assets/plan_image/yoga/plan_yoga.jpg'),
  oly: require('../assets/plan_image/oly/plan_oly.jpg'),
  hyrox: require('../assets/plan_image/hyrox/plan_hyrox_1.jpg'),
  all_access: require('../assets/plan_image/cross/plan_cross.jpg'),
  pase_total: require('../assets/plan_image/cross/plan_cross.jpg'),
};

export const IMAGEN_WELCOME = require('../assets/plan_image/bg_welcome_glow.jpg');

// DEBUG: Verificar que todas las imágenes cargan
console.log('🖼️ IMAGENES_POR_PLAN cargadas:');
Object.keys(IMAGENES_POR_PLAN).forEach(key => {
  const image = IMAGENES_POR_PLAN[key];
  if (image) {
    console.log(`  ✅ ${key}: CARGADA CORRECTAMENTE`);
  } else {
    console.log(`  ❌ ${key}: NO SE PUDO CARGAR - Verificar ruta`);
  }
});