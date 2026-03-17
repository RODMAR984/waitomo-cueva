// contexts/PlanContext.js — Waitomo (FIX definitivo)
// - API idéntica: { plan, setPlan, getRandomImage }
// - Soporta images como:
//    • number (require)
//    • string (uri)
//    • { uri } (obj)
// - Fallback fijo a bgWelcome si no hay imágenes válidas

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import bgWelcome from '../assets/plan_image/bg_welcome_glow.jpg';

const PlanContext = createContext(null);

const normalizeImage = (img) => {
  if (!img) return null;

  // require(...) => number
  if (typeof img === 'number') return img;

  // string => uri
  if (typeof img === 'string') {
    const s = img.trim();
    if (!s) return null;
    return { uri: s };
  }

  // { uri: ... } u otro objeto válido
  if (typeof img === 'object') {
    if (img.uri && String(img.uri).trim()) return img;
    return null;
  }

  return null;
};

export const PlanProvider = ({ children }) => {
  const [plan, setPlan] = useState(null);

  const getRandomImage = useCallback(() => {
    const imgs = plan?.images;

    // 1) images array
    if (Array.isArray(imgs) && imgs.length > 0) {
      const valid = imgs.map(normalizeImage).filter(Boolean);
      if (valid.length > 0) {
        const index = Math.floor(Math.random() * valid.length);
        return valid[index];
      }
    }

    // 2) image single (por si algún plan trae plan.image)
    const single = normalizeImage(plan?.image);
    if (single) return single;

    // 3) fallback
    return bgWelcome;
  }, [plan]);

  const value = useMemo(
    () => ({ plan, setPlan, getRandomImage }),
    [plan, getRandomImage],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlanContext = () => useContext(PlanContext);