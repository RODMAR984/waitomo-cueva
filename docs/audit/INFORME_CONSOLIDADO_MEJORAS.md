# Informe consolidado — Mejoras técnicas y plan de remediación

**Proyecto:** SNIPER RSI v2 + auto_auditor  
**Fecha:** 2026-07-20  
**Tipo:** auditoría técnica/operativa (sin revisión de estrategia de trading)

---

## 1. Documentos incluidos

| Archivo | Contenido |
|---------|-----------|
| `INFORME_SNIPER_RSI_V2.md` / `.pdf` | Bot principal: API, DB, hilos, bugs |
| `INFORME_AUTO_AUDITOR.md` / `.pdf` | Módulo de auditoría periódica |
| `INFORME_CONSOLIDADO_MEJORAS.md` / `.pdf` | Este documento: plan unificado |

**Archivos fuente auditados:**
- `sniper_rsi_v2_fdfb.py` (~1213 líneas)
- `auto_auditor_5053.py` (~240 líneas)

---

## 2. Mapa de riesgos (todos los hallazgos)

```
                    IMPACTO EN PRODUCCIÓN
                 Bajo          Alto
              ┌─────────────┬─────────────┐
    Alta      │ AUD-S12     │ AUD-S01     │
              │ AUD-S30     │ AUD-S04     │
              │             │ AUD-S05     │
              │             │ AUD-S07     │
              │             │ AUD-S17     │
              │             │ AUD-A01     │
 Prob.    ────┼─────────────┼─────────────┤
              │ AUD-S06     │ AUD-S15     │
    Media/    │ AUD-S28     │ AUD-S18     │
    Baja      │             │ AUD-S19     │
              │             │ AUD-S08     │
              │             │ AUD-S22     │
              └─────────────┴─────────────┘
```

---

## 3. Top 10 acciones (orden recomendado)

### Fase 0 — Antes de encender (día 0)

| # | Acción | IDs | Tiempo est. |
|---|--------|-----|-------------|
| 1 | Renombrar `auto_auditor_5053.py` → `auto_auditor.py` | S01, A01 | 5 min |
| 2 | Mover credenciales a variables de entorno; **rotar keys** | S04 | 30 min |
| 3 | Crear `requirements.txt` | S02, A17 | 10 min |
| 4 | DB path absoluto desde `__file__` | S03 | 15 min |

### Fase 1 — Seguridad operativa (día 1)

| # | Acción | IDs | Tiempo est. |
|---|--------|-----|-------------|
| 5 | Filtrar Telegram por `chat_id` | S05 | 10 min |
| 6 | Verificar one-way mode al arranque | S10 | 30 min |
| 7 | Fix `/estado` cuando balance es None | S22 | 5 min |
| 8 | Leverage máximo por símbolo desde exchangeInfo | S07, S33, A19 | 2 h |

### Fase 2 — Corrección de bugs de ejecución (día 2–3)

| # | Acción | IDs | Tiempo est. |
|---|--------|-----|-------------|
| 9 | Unificar RSI Wilder (bot + precio límite) | S15, S16, A09 | 2 h |
| 10 | Fix contabilidad multi-escalón en `monitor_tp_sl` | S17 | 4 h |
| 11 | Cancelar límites del lado opuesto al cambiar side | S18 | 1 h |
| 12 | Idempotencia en detección FILLED | S19 | 1 h |

### Fase 3 — Robustez (semana 1)

| # | Acción | IDs |
|---|--------|-----|
| 13 | recvWindow + reintentos API | S08 |
| 14 | Validar MIN_NOTIONAL por símbolo | S11 |
| 15 | Backoff rate limit -1003 | S12 |
| 16 | WAL SQLite + backup DB | S23, S24 |
| 17 | Logging a archivo rotativo | S30 |
| 18 | Excepciones con detalle en auditor | A13 |
| 19 | Reintentos en descarga de velas | A05 |

---

## 4. Cambios de código sugeridos (snippets)

### 4.1 Variables de entorno (sniper)

```python
API_KEY        = os.environ.get("BINANCE_API_KEY", "")
API_SECRET     = os.environ.get("BINANCE_API_SECRET", "")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT  = os.environ.get("TELEGRAM_CHAT_ID", "")
DB_PATH        = os.environ.get(
    "SNIPER_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "sniper_rsi_v2.db")
)
```

### 4.2 Filtro Telegram

```python
msg = upd.get("message") or {}
if str(msg.get("chat", {}).get("id", "")) != str(TELEGRAM_CHAT):
    continue
txt = (msg.get("text") or "").strip().lower()
```

### 4.3 RSI Wilder unificado (extraer a rsi_utils.py)

Usar la misma función que `auto_auditor.rsi_wilder` para:
- `calcular_rsi_actual(df)` → último valor de la serie Wilder
- `precio_para_rsi()` → ya compatible

### 4.4 Leverage seguro

```python
def max_leverage_permitido(symbol):
    # GET /fapi/v1/leverageBracket o exchangeInfo brackets
    ...

def fijar_leverage(symbol, apal_deseado):
    apal = min(apal_deseado, max_leverage_permitido(symbol))
    ...
```

### 4.5 Multi-escalón — reserva de qty

Mantener en memoria o DB columna `qty_cerrada`; al TP/SL:
```python
pendiente_binance = abs(pos[symbol])
qty_a_cerrar = min(float(t["qty"]), pendiente_binance)
# tras orden exitosa, actualizar trades restantes
```

---

## 5. requirements.txt propuesto

```text
requests>=2.28.0,<3.0.0
numpy>=1.24.0,<3.0.0
pandas>=2.0.0,<3.0.0
```

Opcional producción:
```text
python-dotenv>=1.0.0
```

---

## 6. Estructura de despliegue recomendada

```
/opt/sniper/
├── sniper_rsi_v2.py          # renombrar desde _fdfb
├── auto_auditor.py
├── rsi_utils.py              # nuevo (Wilder compartido)
├── .env                      # secretos (chmod 600)
├── data/
│   └── sniper_rsi_v2.db
├── logs/
│   └── sniper.log
└── requirements.txt
```

**systemd** (fragmento):
```ini
WorkingDirectory=/opt/sniper
EnvironmentFile=/opt/sniper/.env
ExecStart=/usr/bin/python3 /opt/sniper/sniper_rsi_v2.py
Restart=on-failure
RestartSec=10
```

---

## 7. Registro completo de hallazgos

### SNIPER RSI v2 (33 ítems)

| ID | Sev | Título |
|----|-----|--------|
| S01 | CRÍ | Import auto_auditor |
| S02 | ALTA | Dependencias no declaradas |
| S03 | MED | DB path relativo |
| S04 | CRÍ | Credenciales en código |
| S05 | CRÍ | Telegram sin auth chat |
| S06 | BAJA | HTML sin escape |
| S07 | CRÍ | Leverage 25 vs max símbolo |
| S08 | ALTA | Sin recvWindow |
| S09 | ALTA | API responses no validadas |
| S10 | ALTA | Hedge mode |
| S11 | ALTA | MIN_NOTIONAL fijo |
| S12 | MED | Rate limit |
| S13 | MED | Formato query string |
| S14 | BAJA | workingType STOP |
| S15 | ALTA | RSI EWM vs Wilder |
| S16 | MED | Ventana velas inconsistente |
| S17 | CRÍ | Multi-escalón qty |
| S18 | ALTA | Límites lado opuesto |
| S19 | ALTA | Race FILLED |
| S20 | MED | Escalón 0 vs 1-based |
| S21 | MED | SL real fallido |
| S22 | ALTA | /estado None crash |
| S23 | MED | Sin WAL SQLite |
| S24 | MED | Sin backup DB |
| S25 | MED | Locks incompletos |
| S28 | BAJA | Sin graceful shutdown |
| S29 | BAJA | modo_pausa sin lock |
| S30 | MED | Solo log consola |
| S31 | MED | Errores silenciados |
| S32 | INFO | Contrato auditor OK |
| S33 | ALTA | apal 25 en propuesta |

### auto_auditor (19 ítems)

| ID | Sev | Título |
|----|-----|--------|
| A01 | CRÍ | Nombre módulo |
| A02 | BAJA | Sin CLI |
| A03 | INFO | Contrato salida OK |
| A04 | ALTA | Sin validar símbolo |
| A05 | MED | Break silencioso descarga |
| A06 | INFO | Paginación OK |
| A07 | MED | Tiempo largo auditoría |
| A08 | INFO | Geo restricción Binance |
| A09 | INFO | Wilder correcto |
| A10 | BAJA | ap==0 edge case |
| A11 | INFO | Cap MAX_VELAS |
| A12 | INFO | Selección mejor nivel |
| A13 | ALTA | Excepciones sin detalle |
| A14 | MED | sin_datos no en listas |
| A15 | BAJA | Duplicados descartar |
| A16 | INFO | Deps mínimas |
| A17 | MED | Sin pin versiones |
| A18 | INFO | tp_pct alineado |
| A19 | ALTA | Leverage integración bot |

---

## 8. Qué NO se auditó (por diseño)

- Número de activos, niveles RSI base, TP %, SL %, grid 4×3
- % capital usable, señales diseño, trailing 0.5%
- Criterios núcleo/ampliación del auditor (ratio 1.5 / 1.3)
- Rentabilidad esperada, backtest validity, forward performance

---

## 9. Próximo paso sugerido

1. Descargar los 3 PDF de esta carpeta.
2. Aplicar Fase 0 + Fase 1 antes de operar con capital real.
3. Probar 48h con **1 símbolo** y qty mínima tras Fase 2.
4. Escalar a lista completa solo con multi-escalón verificado (S17).

---

*Documento generado automáticamente — FitEngine / auditoría bots trading*
