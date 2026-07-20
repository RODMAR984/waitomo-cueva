# Changelog — bots finales (infraestructura)

Fecha: 2026-07-20

## Archivos entregables

- `sniper_rsi_v2.py` — bot principal
- `auto_auditor.py` — auditor (nombre obligatorio para el import)
- `requirements.txt`
- `README_BOTS_FINALES.md`

## Incluido (correcciones + infra)

- RSI Wilder unificado (TV / Binance chart / auditor / lado / precio limite)
- Leverage efectivo = min(config, max del par)
- Multi-escalon: qty disponible repartida sin solape
- Cancelacion de limites del lado opuesto
- FILLED idempotente (`fill_order_id`)
- recvWindow + reintentos API acotados (max 3)
- SL real: max 2 intentos, luego SL virtual (sin spam)
- MIN_NOTIONAL por simbolo
- Chequeo hedge/one-way al arranque
- SQLite WAL + backup `.bak` al inicio
- Log rotativo a archivo
- `/estado` seguro si balance es None
- Formato decimal en qty/price (sin notacion cientifica)
- Apagado graceful SIGTERM/SIGINT
- Auditor: reintentos descarga, validacion simbolos, detalle errores, CLI

## Excluido a pedido del usuario

- Mover keys a variables de entorno
- Filtro de `chat_id` en Telegram

## Estrategia intacta

Sin cambios en: CONFIG base RSI, TP_PCT, SL_PCT, grid 4x3, trailing,
PCT_CAPITAL_USABLE, SENALES_DISENO, criterios nucleo/ampliacion del auditor.
