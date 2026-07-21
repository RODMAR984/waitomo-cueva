#!/usr/bin/env python3
# ==========================================================
#  auditor_bot_rsi.py — AUDITOR SINCERO v4
#
#  LONG y SHORT se buscan POR SEPARADO (no espejo 100-x).
#  El mejor RSI long / mejor RSI short son hallazgos estadisticos.
#  A partir de CADA base se escalona el grid hacia el estiramiento:
#    long:  base_L, base_L-paso, base_L-2*paso, ...
#    short: base_S, base_S+paso, base_S+2*paso, ...
#
#  Reglas amargas: SL/LIQ antes que TP misma vela, fees, funding,
#  slip, fill solo si el LIMIT toca, cupo 5 senales (1 moneda=1).
#
#  CRITERIO DE SELECCION (v4 — no confundir con v3):
#  Se elige el nivel por TASA DE ACIERTO de la SENAL COMPLETA, no por
#  cantidad de escalones ni por plata de casos raros. Una "senal" es
#  UN toque del nivel: arranca en la primera entrada y termina cuando
#  se cierra todo (TP directo, TP+grid+trailing, SL o LIQ). Se mide,
#  de TODAS las senales que dio ese nivel en la ventana historica:
#    - winrate: % de senales que terminan en positivo (entren por TP
#      directo o rescatadas por el grid/trailing, da lo mismo el camino)
#    - liq_pct: % de senales que terminaron en LIQUIDACION real (esto
#      tiene que ser casi 0 — el grid + SL estan para evitarlo)
#  La expectativa en USD/ROE queda como desempate MENOR, no como motor
#  de eleccion (no elegimos "el nivel que mas plata dio", elegimos "el
#  nivel que revierte mas confiablemente y casi nunca liquida").
#
#  MEJORAS (segun SPECS_MEJORAS_AUDITOR.md):
#   1) Apalancamiento optimo por activo — ya existia, solo se confirma
#      (el score elige el x25..x50 que mejor rinde SEGURO, sin forzar).
#   2) Colchon de SL probado (0.92/0.88/0.85 de la distancia a liq) —
#      se anida al barrido de apalancamientos; el score_lado NO cambia,
#      el colchon que menos liquida gana solo via la penalizacion de liq.
#   3) Perfil de reversion por senal (MFE, MAE, velas hasta el MFE) con
#      percentiles p50/p70/p90 — es SOLO informativo, no cambia el TP
#      (el TP sigue siendo 70% del MFE promedio, calculado aparte).
# ==========================================================

from __future__ import annotations

import argparse
import csv
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
import requests

BASE_URL = "https://fapi.binance.com"

# ---------- universos ----------
# Activos actuales del bot + candidatos extra para barrer
ACTIVOS_ACTUALES = [
    "XMRUSDT", "AVAXUSDT", "ETCUSDT", "ATOMUSDT", "LTCUSDT",
    "NEOUSDT", "DOTUSDT", "LINKUSDT", "ICXUSDT", "QTUMUSDT",
    "ZILUSDT", "VETUSDT", "RVNUSDT", "BABAUSDT", "ENSUSDT",
    "XVSUSDT", "APTUSDT",
]
# ~20 conocidos / liquidos para sumar a los 17 (sin duplicar)
CANDIDATOS_EXTRA = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
    "ADAUSDT", "DOGEUSDT", "TRXUSDT", "TONUSDT", "NEARUSDT",
    "ARBUSDT", "OPUSDT", "SUIUSDT", "INJUSDT", "AAVEUSDT",
    "UNIUSDT", "BCHUSDT", "FILUSDT", "LDOUSDT", "XLMUSDT",
]

# Niveles a rastrear — INDEPENDIENTES por lado (no pares)
NIVELES_LONG = [30.0, 28.0, 25.0, 22.0, 20.0, 18.0, 15.0, 12.0, 10.0]
NIVELES_SHORT = [70.0, 72.0, 75.0, 78.0, 80.0, 82.0, 85.0, 88.0, 90.0]

# ---------- parametros bot / riesgo ----------
RSI_LEN = 14
GRID_ESCALONES = 4
GRID_PASO = 3
TP_PARCIAL = 0.70
TRAIL = 0.005
SENALES_MAX = 5

# APALANCAMIENTOS A PROBAR por activo (de x25 para arriba, decidido con Ro).
# Para cada uno, el SL va "un pelito antes de la liquidacion" de ESE apal.
APALANCAMIENTOS = [25, 30, 35, 40, 50]

# COLCHONES de SL a probar: fraccion de la distancia a la liquidacion.
# 0.92 = SL al filo (colchon chico) ... 0.85 = SL con mas aire (conservador).
COLCHONES_SL = [0.92, 0.88, 0.85]


def liq_pct_de_apal(apal: int) -> float:
    """Distancia a la liquidacion aprox = 100/apal %."""
    return 100.0 / apal


def sl_pct_de_apal(apal: int, colchon: float = 0.92) -> float:
    """SL un pelito ANTES de la liquidacion (colchon% de la distancia a liq)."""
    return round(liq_pct_de_apal(apal) * colchon, 2)


TP_FRAC_DEL_MFE = 0.70   # TP del escalon = 70% del MFE medio del lado
TP_FALLBACK_PCT = 2.0

COMIS_IDA_VUELTA = 0.08
FUND_8H = 0.01
VELAS_8H = 96
SLIPPAGE_PCT = 0.05
MAX_VELAS_TRADE = 288

# ---------- criterio de seleccion (v4: por winrate de SENAL, no por escalon) ----------
MIN_SENALES_LADO = 12     # minimo de senales completas para confiar en la estadistica
WINRATE_NUCLEO = 80.0     # % de senales que cierran en positivo
WINRATE_AMPLIACION = 65.0
LIQ_MAX_TOLERABLE = 5.0   # % de senales que terminan en LIQUIDACION real; por arriba, se descarta si o si
DIAS_DEFAULT = 180        # 6 meses (decidido con Ro)

# variables de la corrida actual (las setea simular_lado segun el apal/colchon probado)
_APAL_ACTUAL = 25
_SL_ACTUAL = sl_pct_de_apal(25)
_LIQ_ACTUAL = liq_pct_de_apal(25)


# ==========================================================
#  datos / RSI
# ==========================================================
def simbolos_perpetuos_trading() -> Optional[set]:
    try:
        r = requests.get(f"{BASE_URL}/fapi/v1/exchangeInfo", timeout=20)
        r.raise_for_status()
        return {
            s["symbol"]
            for s in r.json().get("symbols", [])
            if s.get("status") == "TRADING" and s.get("contractType") == "PERPETUAL"
            and s.get("symbol", "").endswith("USDT")
        }
    except Exception:
        return None


def descargar_velas_5m(symbol: str, dias: int = DIAS_DEFAULT, pausa: float = 0.1, max_reintentos: int = 3, debug: bool = False):
    """Baja hasta `dias` de velas 5m. Con debug=True imprime cada lote."""
    limite = 1500
    ms_por_vela = 5 * 60 * 1000
    hard_cap = (dias * 288) if dias and dias > 0 else (365 * 288)
    fin = int(time.time() * 1000)
    velas = []
    ultimo_error = None
    sin_avance = 0
    vueltas = 0
    while len(velas) < hard_cap:
        vueltas += 1
        lote = None
        for intento in range(max_reintentos):
            try:
                r = requests.get(
                    f"{BASE_URL}/fapi/v1/klines",
                    params={
                        "symbol": symbol,
                        "interval": "5m",
                        "endTime": fin,
                        "limit": limite,
                    },
                    timeout=10,
                )
                if r.status_code in (429, 418):
                    if debug:
                        print(f"      [{symbol}] rate-limit, espero...", flush=True)
                    time.sleep(3.0)
                    continue
                r.raise_for_status()
                lote = r.json()
                break
            except Exception as e:
                ultimo_error = e
                if debug:
                    print(f"      [{symbol}] error req: {str(e)[:50]}", flush=True)
                time.sleep(0.5)
        if lote is None or not lote:
            break
        primera = lote[0][0]
        velas = lote + velas
        if debug and vueltas % 5 == 0:
            print(f"      [{symbol}] {len(velas)} velas...", flush=True)
        nuevo_fin = primera - 1
        if nuevo_fin >= fin:
            sin_avance += 1
            if sin_avance >= 2:
                break
        else:
            sin_avance = 0
        fin = nuevo_fin
        time.sleep(pausa)
        if len(lote) < limite:
            break
    if len(velas) < RSI_LEN + 80:
        if ultimo_error is not None and not velas:
            raise RuntimeError(f"sin velas ({ultimo_error})")
        return None
    if len(velas) > hard_cap:
        velas = velas[-hard_cap:]
    arr = np.array(
        [[int(v[0]), float(v[1]), float(v[2]), float(v[3]), float(v[4])] for v in velas],
        dtype=float,
    )
    return arr[:, 0], arr[:, 1], arr[:, 2], arr[:, 3], arr[:, 4]


def rsi_wilder(closes: np.ndarray, n: int = RSI_LEN) -> np.ndarray:
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
        rsi[i + 1] = 100.0 - 100.0 / (1.0 + rs)
    return rsi


def wilder_avgs(closes: np.ndarray, n: int = RSI_LEN):
    """Devuelve arrays ag[], al[] alineados con closes (para precio_para_rsi rapido)."""
    d = np.diff(closes)
    g = np.where(d > 0, d, 0.0)
    p = np.where(d < 0, -d, 0.0)
    m = len(closes)
    ag_arr = np.full(m, np.nan)
    al_arr = np.full(m, np.nan)
    if len(g) < n:
        return ag_arr, al_arr
    ag = g[:n].mean()
    al = p[:n].mean()
    ag_arr[n] = ag
    al_arr[n] = al
    for i in range(n, len(g)):
        ag = (ag * (n - 1) + g[i]) / n
        al = (al * (n - 1) + p[i]) / n
        ag_arr[i + 1] = ag
        al_arr[i + 1] = al
    return ag_arr, al_arr


def precio_para_rsi_rapido(close_prev, ag, al, rsi_objetivo, side, n=RSI_LEN):
    """Version O(1): recibe ag/al ya calculados (del array precalculado)."""
    if ag is None or al is None or np.isnan(ag) or np.isnan(al):
        return None
    r = rsi_objetivo
    if r <= 0 or r >= 100:
        return None
    rs_obj = r / (100 - r)
    if side == "BUY":
        agn = ag * (n - 1) / n
        P = close_prev - n * (agn / rs_obj - al * (n - 1) / n)
    else:
        aln = al * (n - 1) / n
        P = close_prev + n * (rs_obj * aln - ag * (n - 1) / n)
    if P is None or P <= 0 or not math.isfinite(P):
        return None
    return float(P)


def niveles_grid(base: float, side: str) -> List[float]:
    """Grid desde la base hallada hacia el estiramiento."""
    if side == "BUY":
        return [base - i * GRID_PASO for i in range(GRID_ESCALONES)]
    return [base + i * GRID_PASO for i in range(GRID_ESCALONES)]


def aplicar_slippage(precio: float, side: str, entrando: bool) -> float:
    s = SLIPPAGE_PCT / 100.0
    if entrando:
        return precio * (1 + s) if side == "BUY" else precio * (1 - s)
    return precio * (1 - s) if side == "BUY" else precio * (1 + s)


def costo_holding(velas_abiertas: int) -> float:
    return COMIS_IDA_VUELTA + FUND_8H * (velas_abiertas / VELAS_8H)


# ==========================================================
#  estructuras
# ==========================================================
@dataclass
class Limite:
    escalon: int
    side: str
    precio: float


@dataclass
class Trade:
    symbol: str
    side: str
    escalon: int
    ent_idx: int
    ent: float
    tp: float
    sl: float
    qty_frac: float = 1.0
    fase: int = 0
    pico: float = 0.0
    neta_acum: float = 0.0


@dataclass
class TradeCerrado:
    symbol: str
    side: str
    escalon: int
    ent_idx: int
    sal_idx: int
    ent: float
    sal: float
    motivo: str
    pnl_pct: float
    pnl_roe: float
    liquido: bool
    base_usada: float = 0.0


@dataclass
class Senal:
    """Una senal = UN toque del nivel, desde la primera entrada hasta que
    se cierra TODO (via TP directo, TP+grid+trailing, SL o LIQ). El
    resultado se mide en conjunto, no escalon por escalon.

    mfe/mae/velas_hasta_mfe se miden relativos al precio de la PRIMERA
    entrada de la senal (precio_ref), desde que arranca hasta que cierra
    del todo — es el "perfil de reversion" de esa senal (mejora 3)."""
    pnl: float = 0.0
    tuvo_liq: bool = False
    precio_ref: float = 0.0
    idx_inicio: int = 0
    mfe: float = 0.0
    mae: float = 0.0
    velas_hasta_mfe: int = 0


@dataclass
class SimState:
    side: Optional[str] = None
    limites: Dict[int, Limite] = field(default_factory=dict)
    trades: List[Trade] = field(default_factory=list)
    locked_side: Optional[str] = None  # si fijamos solo long o solo short en busqueda
    senal_actual: Optional[Senal] = None
    senales_cerradas: List[Senal] = field(default_factory=list)

    @property
    def n_abiertos(self) -> int:
        return len(self.trades)

    @property
    def tiene_senal(self) -> bool:
        return self.n_abiertos > 0


# ==========================================================
#  MFE previo (para TP tipo bot/auditor: 70% del MFE medio)
# ==========================================================
def estimar_tp_pct_desde_mfe(c, h, l, rsi, base: float, side: str) -> float:
    """Walk cases de MAX_VELAS midiendo MFE; TP = 70% del MFE promedio."""
    nS = base  # para short, base YA es el umbral alto
    sum_mfe = 0.0
    n_cierre = 0
    en = False
    ent = 0.0
    vel = 0
    mfe = 0.0
    for i in range(RSI_LEN + 2, len(c)):
        r = rsi[i]
        if np.isnan(r):
            continue
        hay = (r <= base) if side == "BUY" else (r >= nS)
        if not en:
            if hay:
                en = True
                ent = c[i]
                vel = 0
                mfe = 0.0
        else:
            vel += 1
            if side == "BUY":
                fav = (h[i] - ent) / ent * 100.0
            else:
                fav = (ent - l[i]) / ent * 100.0
            mfe = max(mfe, fav)
            if vel >= MAX_VELAS_TRADE:
                sum_mfe += mfe
                n_cierre += 1
                en = False
    if n_cierre < 5 or sum_mfe <= 0:
        return TP_FALLBACK_PCT
    return max(0.4, (sum_mfe / n_cierre) * TP_FRAC_DEL_MFE)


# ==========================================================
#  motor de una serie (un simbolo, un lado forzado o libre)
# ==========================================================
def _fav_con(side, ent, h, l):
    if side == "BUY":
        return (h - ent) / ent * 100.0, (ent - l) / ent * 100.0
    return (ent - l) / ent * 100.0, (h - ent) / ent * 100.0


def _cerrar(st, tr, sal_idx, sal_px, motivo, frac, cerrados, base_usada):
    if tr.side == "BUY":
        bruto = (sal_px - tr.ent) / tr.ent * 100.0
    else:
        bruto = (tr.ent - sal_px) / tr.ent * 100.0
    costo = costo_holding(max(0, sal_idx - tr.ent_idx))
    neto_frac = (bruto - costo) * frac
    tr.neta_acum += neto_frac
    if st.senal_actual is not None:
        st.senal_actual.pnl += neto_frac
        if motivo == "LIQ":
            st.senal_actual.tuvo_liq = True
    cerrados.append(
        TradeCerrado(
            symbol=tr.symbol, side=tr.side, escalon=tr.escalon,
            ent_idx=tr.ent_idx, sal_idx=sal_idx, ent=tr.ent, sal=sal_px,
            motivo=motivo, pnl_pct=tr.neta_acum,
            pnl_roe=tr.neta_acum * _APAL_ACTUAL,
            liquido=(motivo == "LIQ"), base_usada=base_usada,
        )
    )


def _actualizar_perfil_senal(st, i, h, l):
    """Mejora 3: MFE/MAE/velas-hasta-MFE de la senal activa, relativos
    al precio de su primera entrada. Se llama una vez por vela mientras
    la senal siga abierta (o sea, siempre que _gestionar corre)."""
    sen = st.senal_actual
    if sen is None or sen.precio_ref <= 0:
        return
    ref = sen.precio_ref
    if st.side == "BUY":
        fav = (h - ref) / ref * 100.0
        con = (ref - l) / ref * 100.0
    else:
        fav = (ref - l) / ref * 100.0
        con = (h - ref) / ref * 100.0
    if fav > sen.mfe:
        sen.mfe = fav
        sen.velas_hasta_mfe = i - sen.idx_inicio
    if con > sen.mae:
        sen.mae = con


def _gestionar(st, i, h, l, c, cerrados, base_usada):
    _actualizar_perfil_senal(st, i, h, l)
    quedan = []
    for tr in st.trades:
        side = tr.side
        _, con = _fav_con(side, tr.ent, h, l)

        # El SL (ej x25: 3.7%) esta ANTES que la liquidacion (4%).
        # Caso normal: el precio toca el SL primero y el STOP_MARKET cierra ahi.
        # Caso peligroso REAL: una mecha/gap en la vela salta directo mas alla
        # de la liquidacion. Ahi el stop no alcanza y liquida de verdad.
        # Ese liq% es la info que sirve para elegir apalancamiento seguro.
        if con >= _SL_ACTUAL:
            if con >= _LIQ_ACTUAL:
                # el movimiento en la vela llego hasta zona de liquidacion.
                # se cuenta como LIQ (gap que el SL no pudo frenar a tiempo).
                sal = tr.ent * (1 - _LIQ_ACTUAL / 100) if side == "BUY" else tr.ent * (1 + _LIQ_ACTUAL / 100)
                _cerrar(st, tr, i, aplicar_slippage(sal, side, False), "LIQ", tr.qty_frac, cerrados, base_usada)
            else:
                # toco el SL pero no la liquidacion: cierre normal en el stop.
                sal = tr.ent * (1 - _SL_ACTUAL / 100) if side == "BUY" else tr.ent * (1 + _SL_ACTUAL / 100)
                _cerrar(st, tr, i, aplicar_slippage(sal, side, False), "SL", tr.qty_frac, cerrados, base_usada)
            continue

        if tr.fase == 0:
            toca = (side == "BUY" and h >= tr.tp) or (side == "SELL" and l <= tr.tp)
            if toca:
                sal = aplicar_slippage(tr.tp, side, False)
                parcial = min(TP_PARCIAL, tr.qty_frac)
                if side == "BUY":
                    bruto = (sal - tr.ent) / tr.ent * 100.0
                else:
                    bruto = (tr.ent - sal) / tr.ent * 100.0
                neto_frac = (bruto - costo_holding(max(0, i - tr.ent_idx))) * parcial
                tr.neta_acum += neto_frac
                if st.senal_actual is not None:
                    st.senal_actual.pnl += neto_frac
                tr.qty_frac -= parcial
                tr.fase = 1
                tr.pico = h if side == "BUY" else l
                if tr.qty_frac <= 1e-12:
                    cerrados.append(
                        TradeCerrado(
                            symbol=tr.symbol, side=side, escalon=tr.escalon,
                            ent_idx=tr.ent_idx, sal_idx=i, ent=tr.ent, sal=sal,
                            motivo="TP_FULL", pnl_pct=tr.neta_acum,
                            pnl_roe=tr.neta_acum * _APAL_ACTUAL, liquido=False,
                            base_usada=base_usada,
                        )
                    )
                    continue
                quedan.append(tr)
                continue
            if i - tr.ent_idx >= MAX_VELAS_TRADE:
                _cerrar(st, tr, i, aplicar_slippage(c, side, False), "TIMEOUT", tr.qty_frac, cerrados, base_usada)
                continue
            quedan.append(tr)
            continue

        if side == "BUY":
            tr.pico = max(tr.pico, h) if tr.pico > 0 else h
            if tr.pico > 0 and (tr.pico - l) / tr.pico >= TRAIL:
                sal = aplicar_slippage(tr.pico * (1 - TRAIL), side, False)
                _cerrar(st, tr, i, sal, "TRAILING", tr.qty_frac, cerrados, base_usada)
                continue
        else:
            tr.pico = min(tr.pico, l) if tr.pico > 0 else l
            if tr.pico > 0 and (h - tr.pico) / tr.pico >= TRAIL:
                sal = aplicar_slippage(tr.pico * (1 + TRAIL), side, False)
                _cerrar(st, tr, i, sal, "TRAILING", tr.qty_frac, cerrados, base_usada)
                continue

        if i - tr.ent_idx >= MAX_VELAS_TRADE:
            _cerrar(st, tr, i, aplicar_slippage(c, side, False), "TIMEOUT", tr.qty_frac, cerrados, base_usada)
            continue
        quedan.append(tr)

    st.trades = quedan
    if not st.trades:
        if st.senal_actual is not None:
            st.senales_cerradas.append(st.senal_actual)
            st.senal_actual = None
        st.side = None
        st.limites.clear()


def precalcular_precios_grid(ag_arr: np.ndarray, al_arr: np.ndarray, c: np.ndarray, base: float, side: str) -> np.ndarray:
    """Precalcula, por cada vela, el precio objetivo de CADA escalon del
    grid (independiente de apal/colchon). Antes se recalculaba adentro
    de _refrescar en las 15 combinaciones (apal x colchon) que prueba
    _eval_nivel; ahora se calcula UNA vez por nivel/lado y se reutiliza
    en las 15, porque el precio-para-RSI no depende del apalancamiento
    ni del colchon de SL."""
    niveles = niveles_grid(base, side)
    n = len(c)
    precios = np.full((GRID_ESCALONES, n), np.nan)
    for esc, niv in enumerate(niveles):
        for i in range(1, n):
            ag, al = ag_arr[i - 1], al_arr[i - 1]
            if np.isnan(ag) or np.isnan(al):
                continue
            p = precio_para_rsi_rapido(c[i - 1], ag, al, niv, side)
            if p is not None:
                precios[esc, i] = p
    return precios


def _refrescar(st, i, precios_grid, rsi_now, px, side_fijo: str):
    """side_fijo = BUY o SELL: en busqueda de nivel solo ese lado.
    precios_grid: array (GRID_ESCALONES, n_velas) precalculado por
    precalcular_precios_grid — el precio objetivo de cada escalon en
    esta vela, ya resuelto (no depende de apal/colchon)."""
    if st.n_abiertos >= GRID_ESCALONES:
        st.limites.clear()
        return
    if st.tiene_senal:
        side = st.side
    else:
        if rsi_now is None or (isinstance(rsi_now, float) and math.isnan(rsi_now)):
            st.limites.clear()
            return
        if side_fijo == "BUY":
            if rsi_now > 50:
                st.limites.clear()
                return
            side = "BUY"
        else:
            if rsi_now < 50:
                st.limites.clear()
                return
            side = "SELL"
        st.side = side

    if side != side_fijo:
        st.limites.clear()
        return

    nuevos = {}
    for esc in range(st.n_abiertos, GRID_ESCALONES):
        p = precios_grid[esc, i]
        if np.isnan(p):
            continue
        if side == "BUY" and p >= px:
            continue
        if side == "SELL" and p <= px:
            continue
        nuevos[esc] = Limite(esc, side, float(p))
    st.limites = nuevos


def _fills(st, symbol, i, h, l, tp_pct):
    if not st.limites:
        return
    era_nueva_senal = st.n_abiertos == 0
    done = []
    for esc in sorted(st.limites):
        if st.n_abiertos >= GRID_ESCALONES:
            break
        lim = st.limites[esc]
        side = lim.side
        toca = (side == "BUY" and l <= lim.precio) or (side == "SELL" and h >= lim.precio)
        if not toca:
            continue
        ent = aplicar_slippage(lim.precio, side, True)
        tp_p, sl_p = tp_pct / 100.0, _SL_ACTUAL / 100.0
        if side == "BUY":
            tp, sl = ent * (1 + tp_p), ent * (1 - sl_p)
        else:
            tp, sl = ent * (1 - tp_p), ent * (1 + sl_p)
        st.trades.append(
            Trade(symbol=symbol, side=side, escalon=esc + 1, ent_idx=i, ent=ent, tp=tp, sl=sl)
        )
        done.append(esc)
    if era_nueva_senal and done:
        # precio de referencia = la primera entrada de la senal (mejora 3)
        st.senal_actual = Senal(precio_ref=st.trades[0].ent, idx_inicio=i)
    for esc in done:
        st.limites.pop(esc, None)


def simular_lado(
    symbol: str,
    ts, o, h, l, c,
    rsi: np.ndarray,
    base: float,
    side_fijo: str,
    tp_pct: float,
    precios_grid: np.ndarray,
) -> Tuple[List[TradeCerrado], List[Senal]]:
    """Simula UN simbolo, UN lado, UNA base (grid desde esa base).
    Devuelve (escalones_cerrados, senales_completas) — la senal completa
    es la unidad que importa para el winrate; el escalon es solo detalle.
    precios_grid: precios objetivo del grid PRECALCULADOS por
    precalcular_precios_grid (no dependen de apal/colchon — calcularlos
    aca adentro los repetia 15 veces por nivel/lado sin necesidad)."""
    st = SimState()
    cerrados: List[TradeCerrado] = []
    n = len(c)
    for i in range(RSI_LEN + 5, n):
        if st.trades:
            _gestionar(st, i, h[i], l[i], c[i], cerrados, base)
        r = rsi[i]
        r_val = float(r) if not np.isnan(r) else float("nan")
        _refrescar(st, i, precios_grid, r_val, c[i], side_fijo)
        if st.limites:
            _fills(st, symbol, i, h[i], l[i], tp_pct)
    last = n - 1
    for tr in list(st.trades):
        _cerrar(st, tr, last, aplicar_slippage(c[last], tr.side, False), "FORCE", tr.qty_frac, cerrados, base)
    st.trades.clear()
    if st.senal_actual is not None:
        st.senales_cerradas.append(st.senal_actual)
        st.senal_actual = None
    return cerrados, st.senales_cerradas


def metricas(cerrados: List[TradeCerrado], senales: List[Senal]) -> dict:
    """Metricas a nivel de SENAL COMPLETA (no de escalon). El winrate es
    lo que decide: de cada vez que el nivel se toco, que % termino bien.
    Incluye el perfil de reversion (mejora 3): percentiles de MFE/MAE y
    velas hasta el MFE — es informativo, NO cambia el TP ni el score."""
    n_sen = len(senales)
    vacio = {
        "senales": 0, "trades": len(cerrados), "winrate": 0.0,
        "expect_roe": 0.0, "avg_win": 0.0, "avg_loss": 0.0,
        "ratio": 0.0, "liq_pct": 0.0,
        "mfe_prom": 0.0, "mfe_p50": 0.0, "mfe_p70": 0.0, "mfe_p90": 0.0,
        "mfe_max": 0.0, "velas_med_mfe": 0.0, "mae_prom": 0.0, "mae_p90": 0.0,
    }
    if n_sen == 0:
        return vacio
    ganadas = [s for s in senales if s.pnl > 0]
    perdidas = [s for s in senales if s.pnl <= 0]
    winrate = len(ganadas) / n_sen * 100.0
    liq_pct = sum(1 for s in senales if s.tuvo_liq) / n_sen * 100.0
    exp = sum(s.pnl for s in senales) / n_sen * _APAL_ACTUAL
    avg_w = sum(s.pnl for s in ganadas) / len(ganadas) if ganadas else 0.0
    avg_l = abs(sum(s.pnl for s in perdidas) / len(perdidas)) if perdidas else 0.0
    ratio = (avg_w / avg_l) if avg_l > 0 else 0.0

    mfes = np.array([s.mfe for s in senales], dtype=float)
    maes = np.array([s.mae for s in senales], dtype=float)
    velas_mfe = np.array([s.velas_hasta_mfe for s in senales], dtype=float)
    # convencion (ver SPECS_MEJORAS_AUDITOR.md): "el 90% de las senales
    # SUPERA X" = percentil 10 real de la distribucion de MFE. Para MAE
    # es al reves: mae_p90 = percentil 90 real ("el peor 10% de sufrimiento").
    mfe_p50 = float(np.percentile(mfes, 50))
    mfe_p70 = float(np.percentile(mfes, 30))
    mfe_p90 = float(np.percentile(mfes, 10))
    mae_p90 = float(np.percentile(maes, 90))

    return {
        "senales": n_sen,
        "trades": len(cerrados),   # escalones ejecutados — solo informativo
        "wr": round(winrate, 1),   # alias legado usado en algunos prints
        "winrate": round(winrate, 1),
        "expect_roe": round(exp, 2),
        "avg_win": round(avg_w, 3),
        "avg_loss": round(avg_l, 3),
        "ratio": round(ratio, 2),
        "liq_pct": round(liq_pct, 1),
        "mfe_prom": round(float(mfes.mean()), 2),
        "mfe_p50": round(mfe_p50, 2),
        "mfe_p70": round(mfe_p70, 2),
        "mfe_p90": round(mfe_p90, 2),
        "mfe_max": round(float(mfes.max()), 2),
        "velas_med_mfe": round(float(np.median(velas_mfe)), 1),
        "mae_prom": round(float(maes.mean()), 2),
        "mae_p90": round(mae_p90, 2),
    }


def score_lado(m: dict) -> float:
    """
    v4 — Elige el nivel por CONFIABILIDAD DEL REBOTE, medida en senales
    completas, no en plata ni en escalones sueltos. (Sin cambios por las
    mejoras 2/3: siguen siendo solo mas combinaciones/mas info sobre la
    misma metrica de siempre.)

    Prioridad real (la que pidio Ro):
      1. winrate de la SENAL completa (de cada toque, cuantas terminan
         bien — de una o rescatadas por el grid) <- lo que manda
      2. que NO liquide casi nunca (penalizacion dura si liq_pct alto)
      3. minimo de senales para confiar en el numero (gate, no bonus)
      4. expectativa en plata: SOLO desempate menor al final
    """
    if m["senales"] < MIN_SENALES_LADO:
        return -1e9 + m["winrate"]
    if m["liq_pct"] > LIQ_MAX_TOLERABLE:
        # aunque rebote bien, si liquida mas de lo tolerable no sirve
        return -1e6 + m["winrate"] - m["liq_pct"]
    return (
        m["winrate"] * 10.0        # confiabilidad del rebote = lo unico que manda
        - m["liq_pct"] * 10.0      # casi nula, castigo fuerte si no
        + m["expect_roe"] * 0.1    # plata: desempate chico, no motor
    )


def _eval_nivel(symbol, ts, o, h, l, c, rsi, niv, side, ag_arr, al_arr):
    """Prueba cada apalancamiento (x25+) Y cada colchon de SL para este
    nivel, y devuelve la combinacion con mejor score (mejora 1 + 2)."""
    global _APAL_ACTUAL, _SL_ACTUAL, _LIQ_ACTUAL
    tp = estimar_tp_pct_desde_mfe(c, h, l, rsi, niv, side)
    # el precio objetivo de cada escalon del grid NO depende de apal/colchon:
    # se precalcula una vez por nivel/lado y se reutiliza en las 15 combos
    precios_grid = precalcular_precios_grid(ag_arr, al_arr, c, niv, side)
    mejor_m = None
    for apal in APALANCAMIENTOS:
        _APAL_ACTUAL = apal
        _LIQ_ACTUAL = liq_pct_de_apal(apal)
        for colchon in COLCHONES_SL:
            _SL_ACTUAL = sl_pct_de_apal(apal, colchon)
            cerr, senales = simular_lado(symbol, ts, o, h, l, c, rsi, niv, side, tp, precios_grid)
            m = metricas(cerr, senales)
            m["nivel"] = niv
            m["tp_pct"] = round(tp, 2)
            m["apal"] = apal
            m["colchon"] = colchon
            m["sl_pct"] = _SL_ACTUAL
            if mejor_m is None or score_lado(m) > score_lado(mejor_m):
                mejor_m = m
    return mejor_m


def _perfil_linea(m: dict) -> str:
    """Linea legible con el perfil de reversion (mejora 3)."""
    return (
        f"MFE p90/p70/p50: {m['mfe_p90']:.1f}/{m['mfe_p70']:.1f}/{m['mfe_p50']:.1f}%  "
        f"prom {m['mfe_prom']:.1f}%  tiempo med {m['velas_med_mfe']:.0f} velas "
        f"({m['velas_med_mfe'] * 5:.0f}min)  MAE prom {m['mae_prom']:.1f}%"
    )


def auditar_activo(symbol: str, series, verbose=True) -> dict:
    ts, o, h, l, c = series
    rsi = rsi_wilder(c)
    # promedios Wilder: no dependen de nivel/lado/apal/colchon, se calculan
    # UNA vez por simbolo (antes se repetian 270 veces adentro de cada sim)
    ag_arr, al_arr = wilder_avgs(c)

    # niveles en SERIE (sin threads anidados: el server es de 1 CPU)
    detalle_L = [_eval_nivel(symbol, ts, o, h, l, c, rsi, niv, "BUY", ag_arr, al_arr) for niv in NIVELES_LONG]
    detalle_S = [_eval_nivel(symbol, ts, o, h, l, c, rsi, niv, "SELL", ag_arr, al_arr) for niv in NIVELES_SHORT]

    mejor_L_m = max(detalle_L, key=score_lado)
    mejor_S_m = max(detalle_S, key=score_lado)
    mejor_L = mejor_L_m["nivel"]
    mejor_S = mejor_S_m["nivel"]

    def clase_lado(m):
        if m is None or m["senales"] < MIN_SENALES_LADO:
            return "pocos"
        if m["liq_pct"] > LIQ_MAX_TOLERABLE:
            return "descartar"
        if m["expect_roe"] <= 0:
            return "descartar"
        if m["winrate"] >= WINRATE_NUCLEO:
            return "nucleo"
        if m["winrate"] >= WINRATE_AMPLIACION:
            return "ampliacion"
        return "descartar"

    cl_L = clase_lado(mejor_L_m)
    cl_S = clase_lado(mejor_S_m)

    # clase activo: nucleo si AMBOS lados nucleo/ampliacion con expect>0
    if cl_L in ("nucleo", "ampliacion") and cl_S in ("nucleo", "ampliacion"):
        if cl_L == "nucleo" and cl_S == "nucleo":
            clase = "nucleo"
        else:
            clase = "ampliacion"
    elif cl_L in ("nucleo", "ampliacion"):
        clase = "solo_long"
    elif cl_S in ("nucleo", "ampliacion"):
        clase = "solo_short"
    else:
        clase = "descartar"

    res = {
        "symbol": symbol,
        "base_long": mejor_L,
        "base_short": mejor_S,
        "tp_long": mejor_L_m["tp_pct"] if mejor_L_m else None,
        "tp_short": mejor_S_m["tp_pct"] if mejor_S_m else None,
        "long": mejor_L_m,
        "short": mejor_S_m,
        "clase_long": cl_L,
        "clase_short": cl_S,
        "clase": clase,
        "grid_long": niveles_grid(mejor_L, "BUY") if mejor_L is not None else [],
        "grid_short": niveles_grid(mejor_S, "SELL") if mejor_S is not None else [],
    }
    if verbose:
        print(
            f"  {symbol}: LONG RSI {mejor_L} (x{mejor_L_m['apal']},c{int(mejor_L_m['colchon']*100)}) "
            f"winrate {mejor_L_m['winrate']}%, liq {mejor_L_m['liq_pct']}%, n={mejor_L_m['senales']}, {cl_L} | "
            f"SHORT RSI {mejor_S} (x{mejor_S_m['apal']},c{int(mejor_S_m['colchon']*100)}) "
            f"winrate {mejor_S_m['winrate']}%, liq {mejor_S_m['liq_pct']}%, n={mejor_S_m['senales']}, {cl_S} → {clase}"
        )
        print(f"           grid L {res['grid_long']} | grid S {res['grid_short']}")
        print(f"           LONG  {_perfil_linea(mejor_L_m)}")
        print(f"           SHORT {_perfil_linea(mejor_S_m)}")
    return res


# ==========================================================
#  IO
# ==========================================================
def imprimir_resumen(resultados: List[dict]):
    print("\n" + "=" * 78)
    print("AUDITOR SINCERO v4 — winrate de senal completa, no plata de casos raros")
    print(f"Niveles L {NIVELES_LONG}")
    print(f"Niveles S {NIVELES_SHORT}")
    print(f"Grid: {GRID_ESCALONES} esc x paso {GRID_PASO} desde CADA base hallada")
    print(f"Apalancamientos: {APALANCAMIENTOS}  Colchones SL: {COLCHONES_SL}")
    print("=" * 78)

    def bloque(titulo, pred):
        items = [r for r in resultados if pred(r)]
        items.sort(
            key=lambda r: -(
                (r["long"]["winrate"] if r["long"] else 0)
                + (r["short"]["winrate"] if r["short"] else 0)
            )
        )
        print(f"\n## {titulo} ({len(items)})")
        if not items:
            print("  (vacio)")
            return
        print(
            f"  {'SYM':<12} {'L':>4} {'S':>4} {'tpL':>5} {'tpS':>5} "
            f"{'nL':>4} {'nS':>4} {'wrL':>6} {'wrS':>6} {'liqL':>5} {'liqS':>5} "
            f"{'apL':>5} {'apS':>5}"
        )
        for r in items:
            L, S = r["long"], r["short"]
            print(
                f"  {r['symbol']:<12} {int(r['base_long']):>4} {int(r['base_short']):>4} "
                f"{r['tp_long']:>5.2f} {r['tp_short']:>5.2f} "
                f"{L['senales']:>4} {S['senales']:>4} "
                f"{L['winrate']:>6.1f} {S['winrate']:>6.1f} "
                f"{L['liq_pct']:>5.1f} {S['liq_pct']:>5.1f} "
                f"x{L['apal']}/c{int(L['colchon']*100):>2} x{S['apal']}/c{int(S['colchon']*100):>2}"
            )

    bloque("NUCLEO (ambos lados OK)", lambda r: r["clase"] == "nucleo")
    bloque("AMPLIACION (ambos lados OK)", lambda r: r["clase"] == "ampliacion")
    bloque("SOLO LONG", lambda r: r["clase"] == "solo_long")
    bloque("SOLO SHORT", lambda r: r["clase"] == "solo_short")
    bloque("DESCARTAR", lambda r: r["clase"] == "descartar")
    print("=" * 78 + "\n")


def guardar_ranking_csv(path: str, resultados: List[dict]):
    cols = [
        "symbol", "clase", "base_long", "base_short", "tp_long", "tp_short",
        "clase_long", "clase_short",
        "apal_long", "colchon_long", "sl_pct_long", "senales_long", "winrate_long",
        "liq_long", "expect_long", "ratio_long",
        "mfe_prom_long", "mfe_p50_long", "mfe_p70_long", "mfe_p90_long", "mfe_max_long",
        "velas_med_mfe_long", "mae_prom_long", "mae_p90_long",
        "apal_short", "colchon_short", "sl_pct_short", "senales_short", "winrate_short",
        "liq_short", "expect_short", "ratio_short",
        "mfe_prom_short", "mfe_p50_short", "mfe_p70_short", "mfe_p90_short", "mfe_max_short",
        "velas_med_mfe_short", "mae_prom_short", "mae_p90_short",
        "grid_long", "grid_short",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in resultados:
            L, S = r["long"], r["short"]
            w.writerow({
                "symbol": r["symbol"],
                "clase": r["clase"],
                "base_long": r["base_long"],
                "base_short": r["base_short"],
                "tp_long": r["tp_long"],
                "tp_short": r["tp_short"],
                "clase_long": r["clase_long"],
                "clase_short": r["clase_short"],
                "apal_long": L["apal"], "colchon_long": L["colchon"], "sl_pct_long": L["sl_pct"],
                "senales_long": L["senales"],
                "winrate_long": L["winrate"], "liq_long": L["liq_pct"],
                "expect_long": L["expect_roe"], "ratio_long": L["ratio"],
                "mfe_prom_long": L["mfe_prom"], "mfe_p50_long": L["mfe_p50"],
                "mfe_p70_long": L["mfe_p70"], "mfe_p90_long": L["mfe_p90"],
                "mfe_max_long": L["mfe_max"], "velas_med_mfe_long": L["velas_med_mfe"],
                "mae_prom_long": L["mae_prom"], "mae_p90_long": L["mae_p90"],
                "apal_short": S["apal"], "colchon_short": S["colchon"], "sl_pct_short": S["sl_pct"],
                "senales_short": S["senales"],
                "winrate_short": S["winrate"], "liq_short": S["liq_pct"],
                "expect_short": S["expect_roe"], "ratio_short": S["ratio"],
                "mfe_prom_short": S["mfe_prom"], "mfe_p50_short": S["mfe_p50"],
                "mfe_p70_short": S["mfe_p70"], "mfe_p90_short": S["mfe_p90"],
                "mfe_max_short": S["mfe_max"], "velas_med_mfe_short": S["velas_med_mfe"],
                "mae_prom_short": S["mae_prom"], "mae_p90_short": S["mae_p90"],
                "grid_long": " ".join(str(int(x)) for x in r["grid_long"]),
                "grid_short": " ".join(str(int(x)) for x in r["grid_short"]),
            })


def universo_default() -> List[str]:
    """Los 17 del bot + ~20 conocidos (sin duplicados)."""
    return list(dict.fromkeys(ACTIVOS_ACTUALES + CANDIDATOS_EXTRA))


def auditar_universo(symbols: List[str], dias: int = DIAS_DEFAULT, progreso=None) -> dict:
    """
    Bridge para bot_rsi.py: audita una lista de simbolos y devuelve el
    mismo formato de salida que consumia el bot (nucleo/ampliacion/
    descartar/sin_datos/detalle), pero calculado con el motor v4
    (winrate de senal completa, long/short independientes, colchon de
    SL probado, perfil de reversion incluido en el detalle).
    `progreso` es un callback opcional (ej: mandar avance por Telegram).
    """
    out = {
        "nucleo": [], "ampliacion": [], "descartar": [], "sin_datos": [],
        "detalle": {},
    }
    validos = simbolos_perpetuos_trading()
    for i, s in enumerate(symbols):
        try:
            if validos is not None and s not in validos:
                out["detalle"][s] = {"error": "symbol_not_found_or_not_trading"}
                out["descartar"].append(s)
                if progreso:
                    progreso(f"{s}: no listado / no TRADING")
                continue
            series = descargar_velas_5m(s, dias=dias)
            if series is None:
                out["sin_datos"].append(s)
                out["detalle"][s] = None
                if progreso:
                    progreso(f"{s}: sin datos suficientes")
                continue
            res = auditar_activo(s, series, verbose=False)
            out["detalle"][s] = res
            cat = res["clase"] if res["clase"] in out else "descartar"
            out[cat].append(s)
            if progreso and (i + 1) % 5 == 0:
                progreso(f"auditados {i + 1}/{len(symbols)}...")
        except Exception as e:
            out["descartar"].append(s)
            out["detalle"][s] = {"error": str(e)}
            if progreso:
                progreso(f"error {s}: {e}")
    return out


def main():
    p = argparse.ArgumentParser(description="Auditor RSI sincero v4 — winrate de senal, long/short independientes")
    p.add_argument("--dias", type=int, default=DIAS_DEFAULT,
                   help="dias de historia 5m; 0=maximo disponible")
    p.add_argument("--workers", type=int, default=1,
                   help="simbolos en paralelo (default 1). Subi a 6-10 si tu red/CPU aguanta")
    p.add_argument("--out", default=".")
    p.add_argument("--symbol", default=None)
    p.add_argument("--solo-actuales", action="store_true", help="solo los 17 del bot")
    p.add_argument("--lista", nargs="*", default=None, help="simbolos a mano")
    args = p.parse_args()

    if args.symbol:
        symbols = [args.symbol]
    elif args.lista:
        symbols = args.lista
    elif args.solo_actuales:
        symbols = list(ACTIVOS_ACTUALES)
    else:
        symbols = universo_default()

    # si hay exchangeInfo, saca del listado los que no esten TRADING
    validos = simbolos_perpetuos_trading()
    if validos is not None:
        antes = len(symbols)
        symbols = [s for s in symbols if s in validos]
        print(f"Lista fija {antes} → {len(symbols)} (sacados los no TRADING)")

    print(f"Barrido: {len(symbols)} simbolos | dias={'MAX' if args.dias<=0 else args.dias} | workers={args.workers} | L≠S independientes")
    print(f"Simbolos: {', '.join(s.replace('USDT','') for s in symbols)}")
    print(f"Long candidatos:  {NIVELES_LONG}")
    print(f"Short candidatos: {NIVELES_SHORT}")
    print(f"Apalancamientos: {APALANCAMIENTOS}  Colchones SL: {COLCHONES_SL}")

    workers = max(1, min(args.workers, len(symbols)))
    print(f"Paralelo: {workers} workers")

    def _job(s):
        print(f"   ... bajando {s.replace('USDT','')}", flush=True)
        d = descargar_velas_5m(s, dias=args.dias)
        if d is None:
            return s, None, "sin datos"
        res = auditar_activo(s, d, verbose=False)
        return s, res, f"{len(d[4])} velas (~{len(d[4])/288:.0f}d)"

    resultados = []
    hechos = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_job, s): s for s in symbols}
        for fut in as_completed(futs):
            hechos += 1
            s = futs[fut]
            try:
                sym, res, msg = fut.result()
                print(f"[{hechos}/{len(symbols)}] {sym}: {msg}", flush=True)
                if res is not None:
                    L, S = res["long"], res["short"]
                    print(
                        f"           L{int(res['base_long'])}(x{L['apal']},c{int(L['colchon']*100)})/"
                        f"S{int(res['base_short'])}(x{S['apal']},c{int(S['colchon']*100)}) "
                        f"winrate {L['winrate']}/{S['winrate']} "
                        f"liq {L['liq_pct']}/{S['liq_pct']} "
                        f"→ {res['clase']}"
                    )
                    print(f"           LONG  {_perfil_linea(L)}")
                    print(f"           SHORT {_perfil_linea(S)}")
                    resultados.append(res)
            except Exception as e:
                print(f"[{hechos}/{len(symbols)}] {s}: ERROR {e}")

    if not resultados:
        print("Nada para rankear.")
        return

    imprimir_resumen(resultados)
    os.makedirs(args.out, exist_ok=True)
    out_csv = os.path.join(args.out, "auditor_sincero_ranking.csv")
    guardar_ranking_csv(out_csv, resultados)
    print(f"CSV: {out_csv}")
    print("Columnas clave: base_long, base_short, grid_long, grid_short (NO son espejo).")


if __name__ == "__main__":
    main()
