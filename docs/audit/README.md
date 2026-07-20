# Informes de auditoría — Bots SNIPER RSI v2

Auditoría técnica y operativa (sin revisión de estrategia de trading).

## Descargas

| Documento | Markdown | PDF |
|-----------|----------|-----|
| Bot principal SNIPER RSI v2 | [INFORME_SNIPER_RSI_V2.md](./INFORME_SNIPER_RSI_V2.md) | [INFORME_SNIPER_RSI_V2.pdf](./INFORME_SNIPER_RSI_V2.pdf) |
| Módulo auto_auditor | [INFORME_AUTO_AUDITOR.md](./INFORME_AUTO_AUDITOR.md) | [INFORME_AUTO_AUDITOR.pdf](./INFORME_AUTO_AUDITOR.pdf) |
| Plan consolidado de mejoras | [INFORME_CONSOLIDADO_MEJORAS.md](./INFORME_CONSOLIDADO_MEJORAS.md) | [INFORME_CONSOLIDADO_MEJORAS.pdf](./INFORME_CONSOLIDADO_MEJORAS.pdf) |

## Regenerar PDFs

```bash
python3 docs/audit/generate_pdfs.py
```

## Alcance

- Arranque, dependencias, despliegue
- Seguridad (credenciales, Telegram)
- API Binance (leverage, filtros, rate limits)
- Bugs funcionales (RSI, multi-escalón, concurrencia)
- Base de datos SQLite
- Integración bot ↔ auditor

**Excluido:** niveles RSI, % capital, TP/SL/trailing como decisiones de estrategia.

## Resumen rápido

- **4 críticos** en sniper (import, credenciales, Telegram, multi-escalón, leverage)
- **1 crítico** en auditor (nombre de módulo)
- Ver plan por fases en el informe consolidado
