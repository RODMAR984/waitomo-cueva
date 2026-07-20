#!/usr/bin/env python3
# ==========================================================
#  auditor_bot_rsi.py  auditoria periodica de activos (v2 infra)
#
#  Misma logica de estrategia validada (niveles, ratios, salida).
#  Cambios solo operativos: reintentos de descarga, validacion
#  de simbolos, errores con detalle, CLI opcional.
# ==========================================================

import argparse
import time
import requests
import numpy as np

BASE_URL = "https://fapi.binance.com"

# parametros del auditor (los validados  NO tocar sin re-medir)
RSI_LEN = 14
NIVELES = [25.0, 20.0, 18.0, 15.0, 12.0]
MAX_VELAS = 288          # cap 1 dia
SL_PCT = 3.7             # pelito antes de liquidar x25
LIQ_PCT = 4.0
COMIS = 0.09
FUND_8H = 0.01
VELAS_8H = 96.0
TP_FRAC_MEDIO = 0.70     # TP medio = 70% del MFE
TP_PARCIAL = 0.70        # cobra 70% en el TP medio
TRAIL = 0.005            # trailing 0.5% del resto

# criterios de inclusion
MIN_CASOS = 20
RATIO_NUCLEO = 1.5
RATIO_AMPLIACION = 1.3

_EXINFO_CACHE = {"symbols": None, "expira": 0}


def simbolos_futures_validos(forzar=False):
    """Cache de simbolos TRADING en USDT-M. None si no se pudo obtener."""
    ahora = time.time()
    if not forzar and _EXINFO_CACHE["symbols"] is not None and ahora < _EXINFO_CACHE["expira"]:
        return _EXINFO_CACHE["symbols"]
    try:
        r = requests.get(f"{BASE_URL}/fapi/v1/exchangeInfo", timeout=20)
        r.raise_for_status()
        syms = {
            s["symbol"]
            for s in r.json().get("symbols", [])
            if s.get("status") == "TRADING" and s.get("contractType") == "PERPETUAL"
        }
        _EXINFO_CACHE["symbols"] = syms
        _EXINFO_CACHE["expira"] = ahora + 3600
        return syms
    except Exception:
        return _EXINFO_CACHE["symbols"]


def descargar_velas_5m(symbol, dias=70, pausa=0.25, max_reintentos=3):
    """Baja `dias` de velas 5m paginando hacia atras. Devuelve (o,h,l,c) numpy."""
    limite = 1500
    ms_por_vela = 5 * 60 * 1000
    total = dias * 288
    fin = int(time.time() * 1000)
    velas = []
    ultimo_error = None
    while len(velas) < total:
        inicio = fin - limite * ms_por_vela
        lote = None
        for intento in range(max_reintentos):
            try:
                r = requests.get(
                    f"{BASE_URL}/fapi/v1/klines",
                    params={
                        "symbol": symbol,
                        "interval": "5m",
                        "startTime": inicio,
                        "endTime": fin,
                        "limit": limite,
                    },
                    timeout=15,
                )
                if r.status_code == 429:
                    time.sleep(1.5 * (intento + 1))
                    continue
                r.raise_for_status()
                lote = r.json()
                break
            except Exception as e:
                ultimo_error = e
                time.sleep(0.4 * (intento + 1))
        if lote is None:
            break
        if not lote:
            break
        velas = lote + velas
        fin = lote[0][0] - 1
        time.sleep(pausa)
        if len(lote) < limite:
            break
    if len(velas) < RSI_LEN + MAX_VELAS:
        if ultimo_error is not None and not velas:
            raise RuntimeError(f"sin velas ({ultimo_error})")
        return None
    arr = np.array([[float(v[1]), float(v[2]), float(v[3]), float(v[4])] for v in velas])
    return arr[:, 0], arr[:, 1], arr[:, 2], arr[:, 3]   # o, h, l, c


def rsi_wilder(closes, n=RSI_LEN):
    """Serie completa de RSI Wilder (misma familia que TradingView / Binance chart)."""
    d = np.diff(closes)
    g = np.where(d > 0, d, 0.0)
    p = np.where(d < 0, -d, 0.0)
    rsi = np.full(len(closes), np.nan)
    if len(g) < n:
        return rsi
    ag = g[:n].mean()
    ap = p[:n].mean()
    for i in range(n, len(g)):
        ag = (ag * (n - 1) + g[i]) / n
        ap = (ap * (n - 1) + p[i]) / n
        rs = ag / ap if ap > 0 else np.inf
        rsi[i + 1] = 100 - 100 / (1 + rs)
    return rsi


def auditar_activo(symbol, dias=70):
    """
    Corre el auditor completo. Devuelve dict con el mejor nivel y sus metricas,
    o None si no hay datos suficientes.
    """
    datos = descargar_velas_5m(symbol, dias)
    if datos is None:
        return None
    o, h, l, c = datos
    rsi = rsi_wilder(c)

    mejor = None
    for nivel in NIVELES:
        nS = 100.0 - nivel
        # ---- FASE 1: MFE/MAE walk-forward + FASE 2: simulacion salida C ----
        en_caso = False
        caso_long = False
        caso_ent = 0.0
        caso_vel = 0
        caso_mfe = 0.0
        caso_mae = 0.0
        n_casos = 0
        sum_mfe = 0.0
        sum_mae = 0.0
        n_liq = 0

        en_tr = False
        tr_long = False
        tr_ent = 0.0
        tr_vel = 0
        tr_tp = 0.0
        tr_fase = 0
        tr_resto = 1.0
        tr_pico = 0.0
        tr_neta = 0.0
        t_gana = 0
        t_pierde = 0
        t_neta_total = 0.0
        t_n = 0

        for i in range(RSI_LEN + 2, len(c)):
            r = rsi[i]
            if np.isnan(r):
                continue
            es_l = r <= nivel
            es_s = r >= nS
            hay = es_l or es_s

            # FASE 1
            if not en_caso:
                if hay:
                    en_caso = True
                    caso_long = es_l
                    caso_ent = c[i]
                    caso_vel = 0
                    caso_mfe = 0.0
                    caso_mae = 0.0
                    n_casos += 1
            else:
                caso_vel += 1
                fav = (h[i] - caso_ent) / caso_ent * 100 if caso_long else (caso_ent - l[i]) / caso_ent * 100
                con = (caso_ent - l[i]) / caso_ent * 100 if caso_long else (h[i] - caso_ent) / caso_ent * 100
                caso_mfe = max(caso_mfe, fav)
                caso_mae = max(caso_mae, con)
                if caso_vel >= MAX_VELAS:
                    sum_mfe += caso_mfe
                    sum_mae += caso_mae
                    if caso_mae >= LIQ_PCT:
                        n_liq += 1
                    en_caso = False

            cerrados = n_casos - (1 if en_caso else 0)
            mfe_prom = sum_mfe / cerrados if cerrados > 0 else 0.0
            listo = cerrados >= 10 and mfe_prom > 0
            tp_medio = mfe_prom * TP_FRAC_MEDIO

            # FASE 2: salida C (70% al TP medio + 30% trailing)
            if not en_tr:
                if hay and listo:
                    en_tr = True
                    tr_long = es_l
                    tr_ent = c[i]
                    tr_vel = 0
                    tr_tp = tp_medio
                    tr_fase = 0
                    tr_resto = 1.0
                    tr_pico = 0.0
                    tr_neta = 0.0
            else:
                tr_vel += 1
                fav = (h[i] - tr_ent) / tr_ent * 100 if tr_long else (tr_ent - l[i]) / tr_ent * 100
                con = (tr_ent - l[i]) / tr_ent * 100 if tr_long else (h[i] - tr_ent) / tr_ent * 100
                costo = COMIS + FUND_8H * (tr_vel / VELAS_8H)
                cerrar = False

                if con >= SL_PCT:
                    tr_neta += tr_resto * (-SL_PCT - costo)
                    cerrar = True
                else:
                    if tr_fase == 0 and fav >= tr_tp:
                        tr_neta += TP_PARCIAL * (tr_tp - costo)
                        tr_resto -= TP_PARCIAL
                        tr_fase = 1
                        tr_pico = fav
                    if tr_fase == 1 and tr_resto > 0:
                        tr_pico = max(tr_pico, fav)
                        retro = tr_pico - fav
                        if retro >= TRAIL * 100:
                            salida = tr_pico - TRAIL * 100
                            tr_neta += tr_resto * (salida - costo)
                            tr_resto = 0.0
                            cerrar = True
                if not cerrar and tr_vel >= MAX_VELAS:
                    pnl = (c[i] - tr_ent) / tr_ent * 100 if tr_long else (tr_ent - c[i]) / tr_ent * 100
                    tr_neta += tr_resto * (pnl - costo)
                    cerrar = True
                if cerrar:
                    t_neta_total += tr_neta
                    t_n += 1
                    if tr_neta > 0:
                        t_gana += 1
                    else:
                        t_pierde += 1
                    en_tr = False

        if n_casos < MIN_CASOS or t_n < 10:
            continue
        mfe_p = sum_mfe / n_casos
        mae_p = sum_mae / n_casos
        ratio = mfe_p / mae_p if mae_p > 0 else 0.0
        liq_pct = n_liq / n_casos * 100
        wr = t_gana / t_n * 100 if t_n > 0 else 0.0
        exp = t_neta_total / t_n * 25 if t_n > 0 else 0.0   # apalancada x25

        res = {
            "symbol": symbol,
            "nivel": nivel,
            "casos": n_casos,
            "mfe": round(mfe_p, 2),
            "mae": round(mae_p, 2),
            "ratio": round(ratio, 2),
            "liq": round(liq_pct, 0),
            "winrate": round(wr, 0),
            "expect": round(exp, 1),
            "tp_pct": round(mfe_p * TP_FRAC_MEDIO, 2),
            "trades": t_n,
        }
        if mejor is None or (res["ratio"] > mejor["ratio"] and res["expect"] > 0):
            mejor = res

    return mejor


def clasificar(res):
    """nucleo / ampliacion / descartar / sin_datos segun criterios validados."""
    if res is None:
        return "sin_datos"
    if isinstance(res, dict) and res.get("error"):
        return "descartar"
    if res["expect"] <= 0:
        return "descartar"
    if res["ratio"] >= RATIO_NUCLEO and res["casos"] >= MIN_CASOS:
        return "nucleo"
    if res["ratio"] >= RATIO_AMPLIACION and res["casos"] >= MIN_CASOS:
        return "ampliacion"
    return "descartar"


def auditar_universo(symbols, dias=70, progreso=None):
    """
    Audita una lista de symbols. Devuelve:
      {"nucleo": [...], "ampliacion": [...], "descartar": [...],
       "sin_datos": [...], "detalle": {...}}
    `progreso` es un callback opcional (ej: mandar avance por Telegram).
    """
    out = {
        "nucleo": [],
        "ampliacion": [],
        "descartar": [],
        "sin_datos": [],
        "detalle": {},
    }
    validos = simbolos_futures_validos()
    for i, s in enumerate(symbols):
        try:
            if validos is not None and s not in validos:
                out["detalle"][s] = {"error": "symbol_not_found_or_not_trading"}
                out["descartar"].append(s)
                if progreso:
                    progreso(f"{s}: no listado / no TRADING")
                continue
            res = auditar_activo(s, dias)
            cat = clasificar(res)
            out["detalle"][s] = res
            if cat in out:
                out[cat].append(s)
            if progreso and (i + 1) % 5 == 0:
                progreso(f"auditados {i + 1}/{len(symbols)}...")
        except Exception as e:
            out["descartar"].append(s)
            out["detalle"][s] = {"error": str(e)}
            if progreso:
                progreso(f"error {s}: {e}")
        time.sleep(0.5)
    return out


def main_cli():
    p = argparse.ArgumentParser(description="Auditor RSI FitEngine (debug)")
    p.add_argument("--symbol", default=None, help="Un solo simbolo, ej BTCUSDT")
    p.add_argument("--dias", type=int, default=70)
    p.add_argument("--lista", nargs="*", default=None, help="Varios simbolos")
    args = p.parse_args()
    if args.symbol:
        r = auditar_activo(args.symbol, args.dias)
        print(r)
        print("clase:", clasificar(r))
        return
    symbols = args.lista or ["BTCUSDT", "ETHUSDT"]
    out = auditar_universo(symbols, dias=args.dias, progreso=print)
    print("nucleo:", out["nucleo"])
    print("ampliacion:", out["ampliacion"])
    print("sin_datos:", out["sin_datos"])
    print("descartar:", out["descartar"])


if __name__ == "__main__":
    main_cli()
