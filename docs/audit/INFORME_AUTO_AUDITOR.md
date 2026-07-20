# Informe de auditoría técnica — auto_auditor

**Archivo auditado:** `auto_auditor_5053.py`  
**Fecha:** 2026-07-20  
**Alcance:** módulo de auditoría periódica, descarga de datos, integración con el bot  
**Excluido:** criterios de selección (ratio MFE/MAE, expectativa, niveles 25/20/18/15/12, días de histórico)

---

## 1. Resumen ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| Crítica   | 1        |
| Alta      | 4        |
| Media     | 6        |
| Baja      | 5        |

**Veredicto:** el módulo es **autocontenido, sintácticamente válido** y cumple el contrato esperado por `correr_auditoria()`. El único bloqueador de integración es el **nombre de archivo** (`auto_auditor_5053.py` vs `import auto_auditor`). Mejoras recomendadas: manejo de errores, trazabilidad, validación de símbolos y alineación RSI con el bot principal.

---

## 2. Bloqueantes e integración

### AUD-A01 · Nombre de módulo incompatible (CRÍTICA)

**Problema:** el bot hace `import auto_auditor`. Este archivo debe llamarse **`auto_auditor.py`**.

**Alternativa:** empaquetar como paquete Python con `setup.py` / instalar editable.

---

### AUD-A02 · Sin punto de entrada CLI (BAJA)

**Problema:** no hay `if __name__ == "__main__"` para probar un símbolo desde terminal.

**Mejora:**
```bash
python auto_auditor.py --symbol BTCUSDT --dias 70
```

Útil para debug sin levantar el bot completo.

---

### AUD-A03 · Contrato de salida — OK (INFO)

`auditar_universo()` devuelve:
```python
{"nucleo": [], "ampliacion": [], "descartar": [], "detalle": {symbol: dict|None}}
```
Compatible con `correr_auditoria()` del sniper (líneas 1119–1127).

---

## 3. Descarga de datos Binance

### AUD-A04 · Sin validación previa de símbolo (ALTA)

**Ubicación:** `descargar_velas_5m()`

**Problema:** si el símbolo no existe o está delistado, la API devuelve error o lista vacía → `None`. No distingue “sin datos” vs “símbolo inválido”.

**Mejora:** cache de `exchangeInfo` al inicio de `auditar_universo`; skip explícito con razón en `detalle[s] = {"error": "symbol_not_found"}`.

---

### AUD-A05 · Paginación: break silencioso en excepción (MEDIA)

**Ubicación:** líneas 58–59 — `except Exception: break`

**Problema:** error de red a mitad de descarga → dataset parcial tratado como insuficiente (`len(velas) < RSI_LEN + MAX_VELAS`) → `None` sin log.

**Mejora:** reintentos (3x) por lote; propagar último error al callback `progreso`.

---

### AUD-A06 · Límite API 1500 velas por request — OK (INFO)

La paginación hacia atrás con `startTime`/`endTime` es correcta para futuros USDT-M.

---

### AUD-A07 · Tiempo total de auditoría (MEDIA — operativo)

Para ~27 símbolos: ~0.5s sleep entre símbolos + descarga paginada → **varios minutos**. El bot avisa por Telegram; no bloquea el loop principal (corre en thread).

**Mejora opcional:** paralelizar descargas (2–3 workers) respetando rate limits — mejora operativa, no estrategia.

---

### AUD-A08 · Restricción geográfica Binance (INFO)

Desde IPs bloqueadas (ej. algunos cloud US/EU), `fapi.binance.com` responde **451**. En el VPS del usuario debe verificarse conectividad real.

---

## 4. Cálculo RSI y simulación

### AUD-A09 · RSI Wilder — referencia correcta (INFO)

`rsi_wilder()` implementa suavizado tipo Wilder coherente con la fórmula usada en `precio_para_rsi()` del bot.

**Desalineación con el bot en runtime:** el bot usa EWM en `calcular_rsi_actual()` — ver informe SNIPER AUD-S15. El auditor **no** es el culpable; hay que unificar en el bot.

---

### AUD-A10 · Caso borde: `ap == 0` → `rs = inf` (BAJA)

**Ubicación:** línea 85

**Comportamiento:** RSI → 100. Aceptable; coherente con mercado solo alcista en ventana.

---

### AUD-A11 · Simulación Fase 2: cap temporal MAX_VELAS (INFO)

Si no cierra por SL/TP/trailing antes de 288 velas (1 día), cierra a mercado en el close. Comportamiento documentado en comentarios — OK técnico.

---

### AUD-A12 · Selección del “mejor” nivel (INFO — no estrategia)

Criterio `ratio` máximo con `expect > 0` (línea 201). Es lógica de negocio del auditor; no se audita el umbral, solo que **no lanza excepciones** — correcto.

---

## 5. Clasificación y manejo de errores

### AUD-A13 · Excepciones tragan detalle (ALTA)

**Ubicación:** `auditar_universo()` líneas 236–237
```python
except Exception:
    out["descartar"].append(s)
```

**Problemas:**
1. No se guarda `detalle[s]` → Telegram/resumen incompleto.
2. No hay log del error → imposible diagnosticar timeout vs parse vs memoria.

**Corrección:**
```python
except Exception as e:
    out["descartar"].append(s)
    out["detalle"][s] = {"error": str(e)}
    if progreso:
        progreso(f"error {s}: {e}")
```

---

### AUD-A14 · `clasificar(None)` → `"sin_datos"` (MEDIA)

**Problema:** `"sin_datos"` no es clave en `out` inicial → símbolo no aparece en ninguna lista excepto `detalle`.

**Impacto:** el resumen del bot que itera `nucleo`/`ampliacion` no lo cuenta; OK si `detalle` se consulta. Documentar.

---

### AUD-A15 · Duplicados en `descartar` (BAJA)

Si `auditar_activo` lanza, se append a descartar; si además retorna None, `clasificar` da `sin_datos` pero no re-append. Sin duplicado actual — OK.

---

## 6. Dependencias y entorno

### AUD-A16 · Dependencias mínimas (INFO)

- `requests`
- `numpy`

No requiere pandas — ventaja para entornos ligeros.

---

### AUD-A17 · Sin pin de versiones (MEDIA)

**Mejora:** en `requirements.txt` del proyecto:
```
requests>=2.28,<3
numpy>=1.24,<3
```

Evita roturas por cambios de API numpy/requests.

---

## 7. Integración con propuesta del bot

### AUD-A18 · Campo `tp_pct` alineado (INFO)

El bot usa `_tp_medio_desde_res(res) → res["tp_pct"]` que el auditor calcula como `mfe_p * TP_FRAC_MEDIO` — coherente.

---

### AUD-A19 · Apalancamiento no calculado por auditor (ALTA — integración)

El auditor devuelve métricas con `expect` escalado x25 (línea 194) pero **no exporta** leverage máximo del símbolo. El bot hardcodea 25 al aplicar propuesta → fallo en pares 10x (BABAUSDT).

**Mejora:** el bot debe resolver leverage al aplicar, no el auditor (salvo que se añada campo informativo `max_leverage` desde exchangeInfo en el sniper).

---

## 8. Tests recomendados (no estrategia)

| Test | Objetivo |
|------|----------|
| `test_rsi_wilder_known_values` | RSI vs valores de referencia |
| `test_descargar_velas_mock` | Paginación con respuestas fake |
| `test_auditar_activo_insufficient_data` | Retorna None sin crash |
| `test_auditar_universo_exception` | detalle con error |
| `test_clasificar_none` | sin_datos |

---

## 9. Matriz de priorización

| ID | Acción | Esfuerzo |
|----|--------|----------|
| AUD-A01 | Renombrar a auto_auditor.py | 5 min |
| AUD-A13 | Log + detalle en excepciones | 20 min |
| AUD-A04 | Validar símbolos exchangeInfo | 1 h |
| AUD-A05 | Reintentos descarga | 30 min |
| AUD-A02 | CLI debug | 30 min |

---

*Fin del informe auto_auditor*
