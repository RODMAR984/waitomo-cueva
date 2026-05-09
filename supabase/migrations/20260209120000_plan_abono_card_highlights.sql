-- Texto opcional para las líneas con ✓ en selector de planes (cliente) y tarjetas de abonos.
-- Formato: una línea por tilde (saltos de línea). Vacío/null = la app usa heurística por defecto.

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS card_highlights text;
ALTER TABLE public.abonos ADD COLUMN IF NOT EXISTS card_highlights text;

COMMENT ON COLUMN public.plans.card_highlights IS 'Cliente: líneas con tilde en tarjeta del plan (una por línea). Vacío = subtítulo + genéricos.';
COMMENT ON COLUMN public.abonos.card_highlights IS 'Cliente: líneas con tilde en tarjeta del abono (una por línea). Vacío = texto generado desde duración/clases.';
