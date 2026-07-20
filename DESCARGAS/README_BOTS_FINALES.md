# SNIPER RSI v2 — archivos finales (infraestructura)

## Qué hay acá

| Archivo | Uso |
|---------|-----|
| `sniper_rsi_v2.py` | Bot principal (reemplaza `sniper_rsi_v2_fdfb.py`) |
| `auto_auditor.py` | Módulo auditoría (**este nombre exacto**) |
| `requirements.txt` | Dependencias |

## Cómo arrancar

```bash
cd carpeta_donde_estan_los_dos_py
pip install -r requirements.txt
python3 sniper_rsi_v2.py
```

Ambos `.py` deben estar en la **misma carpeta**.

## Qué se corrigió (sin tocar estrategia)

- RSI Wilder unificado (alineado TradingView / chart Binance)
- Leverage = min(config, máximo del par) ? BABAUSDT etc. no rompen
- Multi-escalón: qty disponible se reparte sin solaparse
- Límites del lado opuesto se cancelan
- FILLED idempotente (`fill_order_id`)
- recvWindow + reintentos API acotados (sin spam)
- MIN_NOTIONAL por símbolo
- Chequeo hedge/one-way al arranque
- SQLite WAL + backup `.bak` al inicio
- Log a archivo `sniper_rsi_v2.log`
- `/estado` no crashea si balance es None
- SL real: máx. 2 intentos, luego SL virtual (no mil órdenes)
- Apagado graceful SIGTERM/SIGINT
- Auditor: reintentos descarga, detalle de errores, CLI

## Qué NO se tocó (pedido tuyo)

- Keys / Telegram token en el código
- Filtro de chat_id de Telegram
- Niveles RSI, TP%, SL%, grid, % capital, trailing

## Importante

Al primer arranque crea `sniper_rsi_v2.db` junto al script.
Si tenías DB vieja en otro directorio, copiala a esta carpeta o vas a empezar “limpio”.
