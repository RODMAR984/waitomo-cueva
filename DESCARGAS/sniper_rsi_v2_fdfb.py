#!/usr/bin/env python3
# ==========================================================
#  SNIPER RSI v2 — reversion multiactivo con orden LIMITE pre-calculada
#
#  - 14 activos, cada uno con su nivel RSI propio (validado 69 dias)
#  - Entrada por ORDEN LIMITE: calcula el precio-que-da-RSI-objetivo
#    y deja la orden puesta. Agarra el pinchazo aunque dure 1 segundo.
#  - GRID plano de 4 escalones (nivel base, -3, -6, -9 puntos de RSI).
#    Las 4 limites se dejan puestas de una, se llenan escalonadas solas.
#  - Margen AISLADO por simbolo.
#  - Riesgo DINAMICO: usa hasta MARGEN_MAX del saldo libre, se reparte.
#  - SL real (STOP_MARKET) un pelito antes de liquidar. TP en precio.
#  - Sin cierre por tiempo: o TP o SL.
#  - Recalcula los precios objetivo cada vela (5m) y mueve las limites.
#  - Telegram: reporta cada entrada, TP, SL, y responde comandos.
# ==========================================================

import os
import time
import math
import hmac
import hashlib
import sqlite3
import logging
import threading
import requests
import numpy as np
import pandas as pd
from threading import Lock

import auto_auditor  # modulo de auditoria periodica

# ========= CREDENCIALES =========
API_KEY        = "pyKAKvmsLXqNAj3QE6o0NHEzCTuua7zkGJeVmtLz2mUTSZeIzKeoceC08HCrmPNn"
API_SECRET     = "3onbAq90sL6EEVlZ6icuyUR3pAGGxhLdwuAP5PtvREpA2jQWcjXSDAMajJjYLxtl"
TELEGRAM_TOKEN = "8138670532:AAGADfDNotlIEmNLi9SY3tBn7DAdwFWIC4s"
TELEGRAM_CHAT  = "6900644047"

BASE_URL = "https://fapi.binance.com"
DB_PATH  = "sniper_rsi_v2.db"

# ========= ESTRATEGIA (validada) =========
TIMEFRAME = "5m"
RSI_LEN   = 14

# nivel base (long) de cada activo. short = 100 - base.
CONFIG = {
    "XMRUSDT":  {"base": 18, "apal": 25},
    "AVAXUSDT": {"base": 20, "apal": 25},
    "ETCUSDT":  {"base": 18, "apal": 25},
    "ATOMUSDT": {"base": 18, "apal": 25},
    "LTCUSDT":  {"base": 18, "apal": 25},
    "NEOUSDT":  {"base": 25, "apal": 25},
    "DOTUSDT":  {"base": 25, "apal": 25},
    "LINKUSDT": {"base": 18, "apal": 25},
    "ICXUSDT":  {"base": 18, "apal": 25},
    "QTUMUSDT": {"base": 20, "apal": 25},
    "ZILUSDT":  {"base": 20, "apal": 25},
    "VETUSDT":  {"base": 20, "apal": 25},
    "RVNUSDT":  {"base": 20, "apal": 25},
    "BABAUSDT": {"base": 20, "apal": 25},
    "ENSUSDT":  {"base": 25, "apal": 25},
    "XVSUSDT":  {"base": 18, "apal": 25},
    "APTUSDT":  {"base": 25, "apal": 25},
}
ACTIVOS = list(CONFIG.keys())

# TP = 70% del MFE medido de cada activo (el "MEDIO"). En % de precio.
TP_PCT = {
    "XMRUSDT": 1.37, "AVAXUSDT": 2.56, "ETCUSDT": 1.53, "ATOMUSDT": 2.66,
    "LTCUSDT": 1.83, "NEOUSDT": 2.12, "DOTUSDT": 2.37, "LINKUSDT": 1.96,
    "ICXUSDT": 2.59, "QTUMUSDT": 2.69, "ZILUSDT": 2.05, "VETUSDT": 2.56,
    "RVNUSDT": 2.56, "BABAUSDT": 1.82,
    "ENSUSDT": 2.58, "XVSUSDT": 2.31, "APTUSDT": 2.87,
}
SL_PCT = 3.7   # pelito antes de liquidar a x25

# ========= GRID =========
GRID_ESCALONES = 4       # plano de 4 (el que dio +23%)
GRID_PASO      = 3       # cada escalon: RSI baja 3 puntos

# ========= SALIDA (validada: 15/17 activos, mediana +29% vs TP unico) =========
TP_PARCIAL_PCT = 0.70    # fraccion que cobra al tocar el TP medio
TRAILING_DIST  = 0.005   # 0.5% de retroceso desde el pico cierra el resto

# ========= CAPITAL / RIESGO =========
PCT_CAPITAL_USABLE = 0.70   # usa hasta el 70% del saldo total como margen (dinamico)
SEÑALES_DISENO     = 5      # señales simultaneas para las que dimensionamos el reparto
MAX_POSIC_TOTALES  = 40     # tope duro de posiciones abiertas (5 señales x 4 escalones + aire)
MIN_NOTIONAL       = 5.0    # minimo de Binance por orden

# ========= ESTADO =========
db_lock = Lock()
leverage_lock = Lock()
leverage_cache = {}
margin_type_cache = {}
modo_pausa = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S")
log = logging.getLogger("sniper_v2")


# ==========================================================
#  TELEGRAM
# ==========================================================
def tg(msg: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:
        return
    try:
        requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                      data={"chat_id": TELEGRAM_CHAT, "text": msg, "parse_mode": "HTML"},
                      timeout=10)
    except Exception as e:
        log.warning(f"[TG] {e}")


# ==========================================================
#  BASE DE DATOS
# ==========================================================
def _cargar_config_desde_db():
    """
    Al arrancar: si la tabla config_activos esta vacia, la siembra con los
    valores hardcodeados. Despues SIEMPRE lee de la DB (asi la auditoria
    puede cambiar la lista en runtime sin tocar el codigo).
    """
    global CONFIG, TP_PCT, ACTIVOS
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        filas = conn.execute("SELECT * FROM config_activos").fetchall()
        if not filas:
            # sembrar con los hardcodeados
            for s, cfg in CONFIG.items():
                grupo = "nucleo" if s not in ("DOTUSDT","LINKUSDT","ENSUSDT","APTUSDT") else "ampliacion"
                conn.execute("INSERT OR REPLACE INTO config_activos VALUES (?,?,?,?,?)",
                             (s, cfg["base"], cfg["apal"], TP_PCT.get(s, 2.0), grupo))
            conn.commit()
            filas = conn.execute("SELECT * FROM config_activos").fetchall()
        conn.close()
    # reconstruir CONFIG/TP_PCT/ACTIVOS desde la DB
    CONFIG = {f["symbol"]: {"base": f["base"], "apal": int(f["apal"])} for f in filas}
    TP_PCT = {f["symbol"]: f["tp_pct"] for f in filas}
    ACTIVOS = list(CONFIG.keys())
    log.info(f"⚙️  Config cargada: {len(ACTIVOS)} activos ({', '.join(a.replace('USDT','') for a in ACTIVOS)})")


def db_guardar_propuesta(propuesta):
    """Guarda la propuesta de la ultima auditoria (lista de dicts)."""
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.execute("DELETE FROM propuesta")
        for p in propuesta:
            conn.execute("INSERT OR REPLACE INTO propuesta VALUES (?,?,?,?,?)",
                         (p["symbol"], p["base"], p["apal"], p["tp_pct"], p["grupo"]))
        conn.commit(); conn.close()


def db_leer_propuesta():
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        filas = conn.execute("SELECT * FROM propuesta").fetchall()
        conn.close()
    return filas


def aplicar_propuesta():
    """Copia la propuesta a config_activos y recarga la config en memoria."""
    filas = db_leer_propuesta()
    if not filas:
        return 0
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.execute("DELETE FROM config_activos")
        for f in filas:
            conn.execute("INSERT OR REPLACE INTO config_activos VALUES (?,?,?,?,?)",
                         (f["symbol"], f["base"], f["apal"], f["tp_pct"], f["grupo"]))
        conn.commit(); conn.close()
    _cargar_config_desde_db()
    return len(filas)


def init_db():
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        c = conn.cursor()
        c.execute("""CREATE TABLE IF NOT EXISTS trades (
            trade_id TEXT PRIMARY KEY, symbol TEXT, side TEXT, escalon INTEGER,
            qty REAL, precio_entrada REAL, tp REAL, sl REAL, apal INTEGER,
            order_id_sl TEXT, fase INTEGER DEFAULT 0, pico REAL DEFAULT 0,
            created_at REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS limites (
            symbol TEXT, side TEXT, escalon INTEGER, order_id TEXT, precio REAL,
            PRIMARY KEY (symbol, side, escalon))""")
        c.execute("""CREATE TABLE IF NOT EXISTS cierres (
            symbol TEXT, side TEXT, motivo TEXT, pnl REAL, timestamp REAL)""")
        # config de activos editable en runtime (la auditoria puede cambiarla)
        c.execute("""CREATE TABLE IF NOT EXISTS config_activos (
            symbol TEXT PRIMARY KEY, base REAL, apal INTEGER, tp_pct REAL, grupo TEXT)""")
        # propuesta pendiente de la ultima auditoria (para /aplicar_lista)
        c.execute("""CREATE TABLE IF NOT EXISTS propuesta (
            symbol TEXT PRIMARY KEY, base REAL, apal INTEGER, tp_pct REAL, grupo TEXT)""")
        conn.commit()
        conn.close()
    _cargar_config_desde_db()
    log.info("✅ DB v2 lista")


def db_trades_symbol(symbol):
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM trades WHERE symbol=?", (symbol,)).fetchall()
        conn.close()
    return rows


def db_trades_all():
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM trades").fetchall()
        conn.close()
    return rows


def db_guardar_trade(t):
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.execute("""INSERT OR REPLACE INTO trades
            (trade_id,symbol,side,escalon,qty,precio_entrada,tp,sl,apal,order_id_sl,fase,pico,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (t["trade_id"],t["symbol"],t["side"],t["escalon"],t["qty"],
             t["precio_entrada"],t["tp"],t["sl"],t["apal"],t.get("order_id_sl",""),
             t.get("fase",0),t.get("pico",0.0),time.time()))
        conn.commit(); conn.close()


def db_borrar_trade(trade_id):
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.execute("DELETE FROM trades WHERE trade_id=?", (trade_id,))
        conn.commit(); conn.close()


def db_registrar_cierre(symbol, side, motivo, pnl):
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.execute("INSERT INTO cierres (symbol,side,motivo,pnl,timestamp) VALUES (?,?,?,?,?)",
                     (symbol, side, motivo, pnl, time.time()))
        conn.commit(); conn.close()


def db_limites_symbol(symbol):
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM limites WHERE symbol=?", (symbol,)).fetchall()
        conn.close()
    return rows


def db_guardar_limite(symbol, side, escalon, order_id, precio):
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.execute("""INSERT OR REPLACE INTO limites (symbol,side,escalon,order_id,precio)
                        VALUES (?,?,?,?,?)""", (symbol, side, escalon, order_id, precio))
        conn.commit(); conn.close()


def db_borrar_limites(symbol):
    with db_lock:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.execute("DELETE FROM limites WHERE symbol=?", (symbol,))
        conn.commit(); conn.close()


# ==========================================================
#  BINANCE — lectura
# ==========================================================
_cache_exinfo = {"data": None, "expira": 0}


def _firmar(q):
    return hmac.new(API_SECRET.encode(), q.encode(), hashlib.sha256).hexdigest()


def get_klines(symbol, limit=100):
    try:
        r = requests.get(f"{BASE_URL}/fapi/v1/klines",
                         params={"symbol": symbol, "interval": TIMEFRAME, "limit": limit}, timeout=10)
        r.raise_for_status()
        df = pd.DataFrame(r.json(), columns=["open_time","open","high","low","close","volume",
            "close_time","qav","trades","tbb","tbq","ignore"])
        for col in ["open","high","low","close"]:
            df[col] = df[col].astype(float)
        return df
    except Exception as e:
        log.warning(f"[KLINES] {symbol}: {e}")
        return None


def precio_mercado(symbol):
    try:
        r = requests.get(f"{BASE_URL}/fapi/v1/ticker/price", params={"symbol": symbol}, timeout=8)
        r.raise_for_status()
        return float(r.json()["price"])
    except Exception as e:
        log.warning(f"[PRECIO] {symbol}: {e}")
        return None


def balance_libre():
    try:
        ts = int(time.time()*1000)
        q = f"timestamp={ts}"
        url = f"{BASE_URL}/fapi/v2/balance?{q}&signature={_firmar(q)}"
        r = requests.get(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
        r.raise_for_status()
        for b in r.json():
            if b["asset"] == "USDT":
                return float(b["availableBalance"])
        return 0.0
    except Exception as e:
        log.warning(f"[BALANCE] {e}")
        return None


def margen_usado_total():
    """Suma del margen inicial de todas las posiciones abiertas."""
    try:
        ts = int(time.time()*1000)
        q = f"timestamp={ts}"
        url = f"{BASE_URL}/fapi/v2/positionRisk?{q}&signature={_firmar(q)}"
        r = requests.get(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
        r.raise_for_status()
        total = 0.0
        for p in r.json():
            amt = float(p.get("positionAmt", 0))
            if amt != 0:
                total += float(p.get("initialMargin", 0) or 0)
        return total
    except Exception as e:
        log.warning(f"[MARGEN] {e}")
        return None


def posiciones_abiertas():
    try:
        ts = int(time.time()*1000)
        q = f"timestamp={ts}"
        url = f"{BASE_URL}/fapi/v2/positionRisk?{q}&signature={_firmar(q)}"
        r = requests.get(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
        r.raise_for_status()
        return {p["symbol"]: float(p.get("positionAmt", 0))
                for p in r.json() if float(p.get("positionAmt", 0)) != 0}
    except Exception as e:
        log.warning(f"[POSIC] {e}")
        return None


def _filtros(symbol):
    global _cache_exinfo
    ahora = time.time()
    if _cache_exinfo["data"] is None or ahora > _cache_exinfo["expira"]:
        r = requests.get(f"{BASE_URL}/fapi/v1/exchangeInfo", timeout=10)
        r.raise_for_status()
        _cache_exinfo["data"] = r.json()
        _cache_exinfo["expira"] = ahora + 3600
    sinfo = next((s for s in _cache_exinfo["data"]["symbols"] if s["symbol"] == symbol), None)
    if not sinfo:
        return None
    return {f["filterType"]: f for f in sinfo["filters"]}


def ajustar_qty(symbol, qty):
    try:
        f = _filtros(symbol)
        if not f:
            return None
        lot = f.get("LOT_SIZE")
        step = float(lot["stepSize"]); minq = float(lot["minQty"])
        prec = max(0, int(round(-math.log10(step))))
        q = round(math.floor(qty/step)*step, prec)
        return q if q >= minq and q > 0 else None
    except Exception as e:
        log.warning(f"[QTY] {symbol}: {e}")
        return None


def ajustar_precio(symbol, precio):
    try:
        f = _filtros(symbol)
        pf = f.get("PRICE_FILTER")
        tick = float(pf["tickSize"])
        prec = max(0, int(round(-math.log10(tick))))
        return round(round(precio/tick)*tick, prec)
    except Exception as e:
        log.warning(f"[PRECIO_AJ] {symbol}: {e}")
        return precio


# ==========================================================
#  INVERSION DEL RSI: precio que da RSI = objetivo en la vela nueva
# ==========================================================
def precio_para_rsi(closes, rsi_objetivo, side, n=RSI_LEN):
    """
    closes: lista de cierres (velas cerradas, sin la vela en curso)
    side: 'BUY' (RSI baja) o 'SELL' (RSI sube)
    Devuelve el precio que haria tocar RSI=objetivo en la vela nueva.
    """
    if len(closes) < n + 2:
        return None
    arr = np.array(closes, dtype=float)
    close_prev = arr[-1]
    deltas = np.diff(arr)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    ag = gains[:n].mean()
    al = losses[:n].mean()
    for i in range(n, len(gains)):
        ag = (ag*(n-1) + gains[i]) / n
        al = (al*(n-1) + losses[i]) / n

    r = rsi_objetivo
    if r <= 0 or r >= 100:
        return None
    rs_obj = r/(100-r)

    if side == "BUY":
        # precio baja: gain=0, loss = close_prev - P
        agn = ag*(n-1)/n
        # rs_obj = agn / (al*(n-1)/n + (close_prev-P)/n)
        P = close_prev - n*(agn/rs_obj - al*(n-1)/n)
    else:
        # precio sube: loss=0, gain = P - close_prev
        aln = al*(n-1)/n
        # rs_obj = (ag*(n-1)/n + (P-close_prev)/n) / aln
        P = close_prev + n*(rs_obj*aln - ag*(n-1)/n)
    return P if P and P > 0 and math.isfinite(P) else None


def niveles_grid_rsi(symbol, side):
    """Los 4 niveles de RSI del grid para este activo/lado."""
    base = CONFIG[symbol]["base"]
    if side == "BUY":
        return [base - i*GRID_PASO for i in range(GRID_ESCALONES)]
    else:
        short = 100 - base
        return [short + i*GRID_PASO for i in range(GRID_ESCALONES)]


# ==========================================================
#  BINANCE — escritura
# ==========================================================
def set_isolated(symbol):
    """Pone el simbolo en margen AISLADO (una vez)."""
    if margin_type_cache.get(symbol):
        return
    try:
        ts = int(time.time()*1000)
        q = f"symbol={symbol}&marginType=ISOLATED&timestamp={ts}"
        url = f"{BASE_URL}/fapi/v1/marginType?{q}&signature={_firmar(q)}"
        r = requests.post(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
        # code -4046 = ya estaba en isolated, no es error
        margin_type_cache[symbol] = True
    except Exception as e:
        log.warning(f"[ISOLATED] {symbol}: {e}")


def fijar_leverage(symbol, apal):
    ahora = time.time()
    with leverage_lock:
        ci = leverage_cache.get(symbol)
        if ci and ahora < ci["expira"] and ci["lev"] == apal:
            return
    try:
        ts = int(time.time()*1000)
        q = f"symbol={symbol}&leverage={apal}&timestamp={ts}"
        url = f"{BASE_URL}/fapi/v1/leverage?{q}&signature={_firmar(q)}"
        r = requests.post(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
        if r.status_code == 200:
            with leverage_lock:
                leverage_cache[symbol] = {"lev": apal, "expira": ahora + 6*3600}
    except Exception as e:
        log.warning(f"[LEV] {symbol}: {e}")


def orden_limite(symbol, side, qty, precio, apal):
    """Coloca una orden LIMITE (maker) y devuelve su orderId."""
    try:
        set_isolated(symbol)
        fijar_leverage(symbol, apal)
        precio = ajustar_precio(symbol, precio)
        ts = int(time.time()*1000)
        coid = f"grid_{symbol}_{side}_{ts}"
        q = (f"symbol={symbol}&side={side}&type=LIMIT&timeInForce=GTC"
             f"&quantity={qty}&price={precio}&newClientOrderId={coid}&timestamp={ts}")
        url = f"{BASE_URL}/fapi/v1/order?{q}&signature={_firmar(q)}"
        r = requests.post(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=15)
        if r.status_code == 200:
            return str(r.json().get("orderId"))
        log.warning(f"[LIMIT] {symbol}: {r.text}")
        return None
    except Exception as e:
        log.warning(f"[LIMIT] {symbol}: {e}")
        return None


def orden_market(symbol, side, qty, apal, reduce_only=False):
    try:
        if not reduce_only:
            set_isolated(symbol); fijar_leverage(symbol, apal)
        ts = int(time.time()*1000)
        ro = "&reduceOnly=true" if reduce_only else ""
        q = f"symbol={symbol}&side={side}&type=MARKET&quantity={qty}{ro}&timestamp={ts}"
        url = f"{BASE_URL}/fapi/v1/order?{q}&signature={_firmar(q)}"
        r = requests.post(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=15)
        if r.status_code == 200:
            return r.json()
        log.warning(f"[MARKET] {symbol}: {r.text}")
        return None
    except Exception as e:
        log.warning(f"[MARKET] {symbol}: {e}")
        return None


def poner_stop_real(symbol, side_pos, qty, sl_precio, apal):
    """SL real STOP_MARKET. Red de seguridad si el bot se cae."""
    try:
        lado = "SELL" if side_pos == "BUY" else "BUY"
        stop = ajustar_precio(symbol, sl_precio)
        ts = int(time.time()*1000)
        q = (f"symbol={symbol}&side={lado}&type=STOP_MARKET&stopPrice={stop}"
             f"&quantity={qty}&reduceOnly=true&timestamp={ts}")
        url = f"{BASE_URL}/fapi/v1/order?{q}&signature={_firmar(q)}"
        r = requests.post(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=15)
        if r.status_code == 200:
            return str(r.json().get("orderId"))
        return None
    except Exception as e:
        log.warning(f"[SL] {symbol}: {e}")
        return None


def cancelar_orden(symbol, order_id):
    try:
        ts = int(time.time()*1000)
        q = f"symbol={symbol}&orderId={order_id}&timestamp={ts}"
        url = f"{BASE_URL}/fapi/v1/order?{q}&signature={_firmar(q)}"
        requests.delete(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
    except Exception:
        pass


def cancelar_todas(symbol):
    try:
        ts = int(time.time()*1000)
        q = f"symbol={symbol}&timestamp={ts}"
        url = f"{BASE_URL}/fapi/v1/allOpenOrders?{q}&signature={_firmar(q)}"
        requests.delete(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
    except Exception:
        pass


def estado_orden(symbol, order_id):
    """Devuelve el status de una orden: NEW, FILLED, CANCELED, etc."""
    try:
        ts = int(time.time()*1000)
        q = f"symbol={symbol}&orderId={order_id}&timestamp={ts}"
        url = f"{BASE_URL}/fapi/v1/order?{q}&signature={_firmar(q)}"
        r = requests.get(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
        if r.status_code == 200:
            j = r.json()
            return j.get("status"), float(j.get("avgPrice") or 0), float(j.get("executedQty") or 0)
        return None, 0, 0
    except Exception:
        return None, 0, 0


# ==========================================================
#  TAMANO DE POSICION (riesgo dinamico)
# ==========================================================
def saldo_total():
    """Balance TOTAL (walletBalance), no solo el libre. Para dimensionar el 70%."""
    try:
        ts = int(time.time()*1000)
        q = f"timestamp={ts}"
        url = f"{BASE_URL}/fapi/v2/balance?{q}&signature={_firmar(q)}"
        r = requests.get(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
        r.raise_for_status()
        for b in r.json():
            if b["asset"] == "USDT":
                return float(b["balance"])
        return 0.0
    except Exception as e:
        log.warning(f"[SALDO_TOTAL] {e}")
        return None


def margen_max_actual():
    """El 70% del saldo TOTAL. Dinamico: crece/baja con la cuenta."""
    st = saldo_total()
    if st is None:
        return None
    return st * PCT_CAPITAL_USABLE


def calcular_qty_escalon(symbol, precio_entrada, apal):
    """
    Reparto: (70% del saldo total) / SEÑALES_DISENO / GRID_ESCALONES
    = margen por escalon. Dinamico sobre el saldo.
    Devuelve la qty de UN escalon.
    """
    mmax = margen_max_actual()
    if mmax is None or mmax <= 0:
        return None
    margen_por_señal = mmax / SEÑALES_DISENO
    margen_escalon = margen_por_señal / GRID_ESCALONES
    notional_escalon = margen_escalon * apal
    if notional_escalon < MIN_NOTIONAL:
        notional_escalon = MIN_NOTIONAL   # respeta el minimo de Binance
    qty = ajustar_qty(symbol, notional_escalon / precio_entrada)
    return qty


# ==========================================================
#  COLOCAR / REFRESCAR EL GRID DE LIMITES (cada vela)
# ==========================================================
def refrescar_grid(symbol):
    """
    Recalcula los precios objetivo de los escalones que faltan y deja
    las ordenes limite puestas.
    - Si ya hay posicion abierta, el lado queda FIJO al lado de esa posicion
      (no mezcla long y short en el mismo grid).
    - Solo cancela y repone una limite si su precio objetivo CAMBIO mas de
      un tick (si no cambio, la deja quieta -> no hay ventana sin orden).
    """
    if modo_pausa:
        return

    df = get_klines(symbol, 100)
    if df is None or len(df) < RSI_LEN + 3:
        return
    closes = df["close"].iloc[:-1].tolist()

    trades_abiertos = db_trades_symbol(symbol)
    abiertos = len(trades_abiertos)
    if abiertos >= GRID_ESCALONES:
        return  # grid completo

    # ---- LADO ----
    if abiertos > 0:
        # ya hay posicion: el lado queda FIJO al de la posicion existente
        side = trades_abiertos[0]["side"]
    else:
        rsi_actual = calcular_rsi_actual(df)
        if rsi_actual is None:
            return
        side = "BUY" if rsi_actual <= 50 else "SELL"

    apal = CONFIG[symbol]["apal"]
    niveles = niveles_grid_rsi(symbol, side)

    # tope global de margen: 70% del saldo (dinamico)
    mtot = margen_usado_total()
    mmax = margen_max_actual()
    if mtot is not None and mmax is not None and mtot >= mmax:
        return
    # tope global de cantidad de posiciones
    if len(db_trades_all()) >= MAX_POSIC_TOTALES:
        return

    # limites ya puestas (por escalon)
    limites_actuales = {l["escalon"]: l for l in db_limites_symbol(symbol)}

    precio_actual = precio_mercado(symbol)
    if not precio_actual:
        return
    tick = _tick_size(symbol)

    for esc in range(abiertos, GRID_ESCALONES):
        nivel_rsi = niveles[esc]
        precio_obj = precio_para_rsi(closes, nivel_rsi, side)
        if not precio_obj:
            continue
        # la limite BUY va POR DEBAJO del precio (si no, se ejecutaria ya)
        if side == "BUY" and precio_obj >= precio_actual:
            continue
        if side == "SELL" and precio_obj <= precio_actual:
            continue

        lim_vieja = limites_actuales.get(esc)
        # si ya hay una limite en este escalon y el precio objetivo casi
        # no cambio, la DEJO QUIETA (no hay ventana sin orden)
        if lim_vieja and abs(float(lim_vieja["precio"]) - precio_obj) < tick*2:
            continue

        # el precio objetivo cambio: cancelo la vieja (si habia) y pongo nueva
        if lim_vieja:
            cancelar_orden(symbol, lim_vieja["order_id"])
        qty = calcular_qty_escalon(symbol, precio_obj, apal)
        if not qty:
            continue
        oid = orden_limite(symbol, side, qty, precio_obj, apal)
        if oid:
            db_guardar_limite(symbol, side, esc, oid, precio_obj)


def _tick_size(symbol):
    try:
        f = _filtros(symbol)
        return float(f["PRICE_FILTER"]["tickSize"])
    except Exception:
        return 0.0001


def calcular_rsi_actual(df):
    """RSI incluyendo la vela en curso (para decidir lado)."""
    if df is None or len(df) < RSI_LEN + 2:
        return None
    close = df["close"]
    d = close.diff()
    g = d.clip(lower=0); p = -d.clip(upper=0)
    ag = g.ewm(alpha=1/RSI_LEN, adjust=False).mean()
    ap = p.ewm(alpha=1/RSI_LEN, adjust=False).mean()
    rs = ag / ap.replace(0, 1e-9)
    return float((100 - 100/(1+rs)).iloc[-1])


# ==========================================================
#  DETECTAR LLENADOS: una limite se ejecuto -> abrir posicion + SL + TP
# ==========================================================
def revisar_llenados(symbol):
    limites = db_limites_symbol(symbol)
    for lim in limites:
        status, avg_price, exec_qty = estado_orden(symbol, lim["order_id"])
        if status == "FILLED":
            # se lleno! registro la posicion, pongo SL real, calculo TP
            side = lim["side"]
            escalon = lim["escalon"]
            precio_exec = avg_price if avg_price > 0 else lim["precio"]
            apal = CONFIG[symbol]["apal"]

            tp_p = TP_PCT[symbol]/100.0
            sl_p = SL_PCT/100.0
            if side == "BUY":
                tp = precio_exec*(1+tp_p); sl = precio_exec*(1-sl_p)
            else:
                tp = precio_exec*(1-tp_p); sl = precio_exec*(1+sl_p)

            # SL real con reintento (si falla, avisa: solo queda SL virtual)
            sl_oid = poner_stop_real(symbol, side, exec_qty, sl, apal)
            if not sl_oid:
                time.sleep(0.5)
                sl_oid = poner_stop_real(symbol, side, exec_qty, sl, apal)
            trade_id = f"{symbol}_{escalon}_{int(time.time()*1000)}"
            db_guardar_trade({
                "trade_id": trade_id, "symbol": symbol, "side": side, "escalon": escalon+1,
                "qty": exec_qty, "precio_entrada": precio_exec, "tp": tp, "sl": sl,
                "apal": apal, "order_id_sl": sl_oid or ""})

            # saco esta limite de la tabla (ya se lleno)
            with db_lock:
                conn = sqlite3.connect(DB_PATH, timeout=30)
                conn.execute("DELETE FROM limites WHERE symbol=? AND escalon=?", (symbol, escalon))
                conn.commit(); conn.close()

            emoji = "🟢" if side == "BUY" else "🔴"
            aviso_sl = "" if sl_oid else "\n⚠️ <b>SL real NO se pudo poner</b> (queda SL virtual del monitor)"
            tg(f"{emoji} <b>{symbol}</b> {side} · escalón {escalon+1}/{GRID_ESCALONES}\n"
               f"Entrada: <b>{precio_exec:.5f}</b>\n"
               f"TP: {tp:.5f} ({TP_PCT[symbol]}%)  |  SL: {sl:.5f} ({SL_PCT}%)\n"
               f"Qty: {exec_qty}{aviso_sl}")
            log.info(f"✅ {symbol} {side} E{escalon+1} @ {precio_exec}")
        elif status in ("CANCELED", "EXPIRED", "REJECTED"):
            with db_lock:
                conn = sqlite3.connect(DB_PATH, timeout=30)
                conn.execute("DELETE FROM limites WHERE symbol=? AND escalon=?", (symbol, lim["escalon"]))
                conn.commit(); conn.close()


# ==========================================================
#  MONITOR TP / SL (cierra posiciones)
# ==========================================================
def monitor_tp_sl():
    log.info("👁️ Monitor TP/SL iniciado")
    while True:
        try:
            trades = db_trades_all()
            if not trades:
                time.sleep(3); continue
            pos = posiciones_abiertas()
            if pos is None:
                time.sleep(3); continue

            for t in trades:
                symbol = t["symbol"]
                # la posicion desaparecio (SL real salto, o cierre manual)
                if symbol not in pos:
                    db_borrar_trade(t["trade_id"])
                    db_registrar_cierre(symbol, t["side"], "EXTERNO", 0.0)
                    tg(f"⚠️ <b>{symbol}</b> cerrado por fuera del bot (SL real o manual)")
                    continue

                precio = precio_mercado(symbol)
                if not precio:
                    continue
                side = t["side"]; tp = float(t["tp"]); sl = float(t["sl"])
                qty = float(t["qty"]); ent = float(t["precio_entrada"]); apal = int(t["apal"])
                fase = int(t["fase"] or 0)
                pico = float(t["pico"] or 0.0)
                cierre = "SELL" if side == "BUY" else "BUY"
                disponible = abs(float(pos[symbol]))

                toca_sl = (side=="BUY" and precio<=sl) or (side=="SELL" and precio>=sl)

                # ===== SL: corta TODO lo que quede, en cualquier fase =====
                if toca_sl:
                    q = ajustar_qty(symbol, min(qty, disponible))
                    if not q:
                        db_borrar_trade(t["trade_id"]); continue
                    res = orden_market(symbol, cierre, q, apal, reduce_only=True)
                    if not res:
                        continue
                    salida = float(res.get("avgPrice") or precio)
                    pnl = (salida-ent)*q if side=="BUY" else (ent-salida)*q
                    if t["order_id_sl"]:
                        cancelar_orden(symbol, t["order_id_sl"])
                    db_borrar_trade(t["trade_id"])
                    db_registrar_cierre(symbol, side, "SL", pnl)
                    tg(f"🛑 <b>{symbol}</b> SL · escalón {t['escalon']}\n"
                       f"Entrada {ent:.5f} → Salida {salida:.5f}\n"
                       f"PnL: <b>{pnl:+.2f} USDT</b>")
                    log.info(f"🛑 {symbol} SL PnL {pnl:+.2f}")
                    continue

                if fase == 0:
                    # ===== FASE 0: esperando el TP medio =====
                    toca_tp = (side=="BUY" and precio>=tp) or (side=="SELL" and precio<=tp)
                    if not toca_tp:
                        continue
                    # cierra el 70% de la posicion
                    q_parcial = ajustar_qty(symbol, min(qty*TP_PARCIAL_PCT, disponible))
                    if not q_parcial:
                        continue
                    res = orden_market(symbol, cierre, q_parcial, apal, reduce_only=True)
                    if not res:
                        continue
                    salida = float(res.get("avgPrice") or precio)
                    pnl = (salida-ent)*q_parcial if side=="BUY" else (ent-salida)*q_parcial
                    # el resto (30%) pasa a fase trailing; el pico arranca en el precio actual
                    resto = qty - q_parcial
                    with db_lock:
                        conn = sqlite3.connect(DB_PATH, timeout=30)
                        conn.execute("UPDATE trades SET fase=1, pico=?, qty=? WHERE trade_id=?",
                                     (precio, resto, t["trade_id"]))
                        conn.commit(); conn.close()
                    db_registrar_cierre(symbol, side, "TP_PARCIAL", pnl)
                    tg(f"💰 <b>{symbol}</b> TP parcial (70%) · escalón {t['escalon']}\n"
                       f"Entrada {ent:.5f} → Salida {salida:.5f}\n"
                       f"PnL parcial: <b>{pnl:+.2f} USDT</b>\n"
                       f"🎣 30% restante corriendo con trailing {TRAILING_DIST*100:.1f}%")
                    log.info(f"💰 {symbol} TP parcial PnL {pnl:+.2f}, resto en trailing")
                    continue

                # ===== FASE 1: trailing del 30% restante =====
                # actualizar el pico (maximo favorable)
                if side == "BUY":
                    nuevo_pico = max(pico, precio) if pico > 0 else precio
                    retroceso = (nuevo_pico - precio) / nuevo_pico if nuevo_pico > 0 else 0
                else:
                    nuevo_pico = min(pico, precio) if pico > 0 else precio
                    retroceso = (precio - nuevo_pico) / nuevo_pico if nuevo_pico > 0 else 0

                if nuevo_pico != pico:
                    with db_lock:
                        conn = sqlite3.connect(DB_PATH, timeout=30)
                        conn.execute("UPDATE trades SET pico=? WHERE trade_id=?",
                                     (nuevo_pico, t["trade_id"]))
                        conn.commit(); conn.close()

                if retroceso >= TRAILING_DIST:
                    # el precio retrocedio 0.5% desde el pico: cerrar el resto
                    q = ajustar_qty(symbol, min(qty, disponible))
                    if not q:
                        db_borrar_trade(t["trade_id"]); continue
                    res = orden_market(symbol, cierre, q, apal, reduce_only=True)
                    if not res:
                        continue
                    salida = float(res.get("avgPrice") or precio)
                    pnl = (salida-ent)*q if side=="BUY" else (ent-salida)*q
                    if t["order_id_sl"]:
                        cancelar_orden(symbol, t["order_id_sl"])
                    db_borrar_trade(t["trade_id"])
                    db_registrar_cierre(symbol, side, "TRAILING", pnl)
                    tg(f"🎣 <b>{symbol}</b> trailing cerró el 30% · escalón {t['escalon']}\n"
                       f"Entrada {ent:.5f} → Salida {salida:.5f} (pico {nuevo_pico:.5f})\n"
                       f"PnL resto: <b>{pnl:+.2f} USDT</b>")
                    log.info(f"🎣 {symbol} trailing PnL {pnl:+.2f}")
            time.sleep(2)
        except Exception as e:
            log.warning(f"[MONITOR] {e}")
            time.sleep(5)


# ==========================================================
#  TELEGRAM — comandos
# ==========================================================
def escuchar_telegram():
    global modo_pausa
    if not TELEGRAM_TOKEN:
        return
    offset = 0
    while True:
        try:
            r = requests.get(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates",
                             params={"offset": offset+1, "timeout": 30}, timeout=40)
            for upd in r.json().get("result", []):
                offset = upd["update_id"]
                txt = (upd.get("message", {}).get("text") or "").strip().lower()
                if txt == "/pausa":
                    modo_pausa = True
                    for s in ACTIVOS:
                        cancelar_todas(s); db_borrar_limites(s)
                    tg("⏸️ <b>PAUSA</b> · límites canceladas, no abre nuevas (las posiciones siguen)")
                elif txt == "/seguir":
                    modo_pausa = False
                    tg("▶️ <b>ACTIVO</b>")
                elif txt == "/estado":
                    bal = balance_libre()
                    mtot = margen_usado_total() or 0
                    mmax = margen_max_actual() or 0
                    trades = db_trades_all()
                    pos_txt = "\n".join(
                        f"• {t['symbol']} {t['side']} E{t['escalon']} @ {t['precio_entrada']:.5f}"
                        for t in trades) or "sin posiciones"
                    tg(f"📊 <b>ESTADO</b>\n"
                       f"Balance libre: {bal:.2f} USDT\n"
                       f"Margen usado: {mtot:.2f} / {mmax:.2f} USDT (70% del saldo)\n"
                       f"Pausa: {'sí' if modo_pausa else 'no'}\n"
                       f"Posiciones ({len(trades)}):\n{pos_txt}")
                elif txt == "/cerrar":
                    n = 0
                    for t in db_trades_all():
                        cierre = "SELL" if t["side"]=="BUY" else "BUY"
                        if orden_market(t["symbol"], cierre, float(t["qty"]), int(t["apal"]), reduce_only=True):
                            if t["order_id_sl"]:
                                cancelar_orden(t["symbol"], t["order_id_sl"])
                            db_borrar_trade(t["trade_id"]); n += 1
                    for s in ACTIVOS:
                        cancelar_todas(s); db_borrar_limites(s)
                    tg(f"🔻 Cerradas {n} posiciones y canceladas todas las límites")
                elif txt == "/auditar":
                    tg("🔍 Arrancando auditoría manual (tarda unos minutos)...")
                    threading.Thread(target=correr_auditoria, daemon=True).start()
                elif txt == "/aplicar_lista":
                    n = aplicar_propuesta()
                    if n > 0:
                        for s in ACTIVOS:
                            cancelar_todas(s); db_borrar_limites(s)
                        tg(f"✅ <b>Lista aplicada</b>: {n} activos ahora vigentes.\n"
                           f"{', '.join(a.replace('USDT','') for a in ACTIVOS)}\n"
                           "Límites viejas canceladas, se rearman con la nueva config.")
                    else:
                        tg("No hay ninguna propuesta pendiente. Corré /auditar primero.")
                elif txt in ("/ayuda", "/help", "/start"):
                    tg("<b>SNIPER RSI v2</b>\n"
                       "/estado · balance, margen y posiciones\n"
                       "/pausa · cancela límites, no abre nuevas\n"
                       "/seguir · reactiva\n"
                       "/cerrar · cierra todo a mercado\n"
                       "/auditar · corre la auditoría de activos ahora\n"
                       "/aplicar_lista · aplica la última propuesta de auditoría")
        except Exception as e:
            log.warning(f"[TG-LISTEN] {e}")
            time.sleep(5)


# ==========================================================
#  LOOP PRINCIPAL
# ==========================================================
def limpiar_ordenes_huerfanas():
    """
    Limpiador: cancela ordenes que quedaron 'muertas' en Binance.
    - Limites del grid que ya no estan en la DB (no las estamos rastreando).
    - SL reales de posiciones que ya no existen.
    - Cualquier orden abierta de un symbol SIN posicion NI limites en la DB.
    Corre cada pocos minutos. Evita acumular ordenes zombis y tocar el
    limite de ~10 condicionales por symbol de Binance.
    """
    try:
        pos = posiciones_abiertas()
        if pos is None:
            return
        for symbol in ACTIVOS:
            # ordenes abiertas reales en Binance para este symbol
            try:
                ts = int(time.time()*1000)
                q = f"symbol={symbol}&timestamp={ts}"
                url = f"{BASE_URL}/fapi/v1/openOrders?{q}&signature={_firmar(q)}"
                r = requests.get(url, headers={"X-MBX-APIKEY": API_KEY}, timeout=10)
                if r.status_code != 200:
                    continue
                ordenes = r.json()
            except Exception:
                continue

            if not ordenes:
                continue

            # IDs que el bot esta rastreando legitimamente
            ids_limites = {l["order_id"] for l in db_limites_symbol(symbol)}
            ids_sl = {t["order_id_sl"] for t in db_trades_symbol(symbol) if t["order_id_sl"]}
            ids_legitimos = ids_limites | ids_sl

            tiene_posicion = symbol in pos
            tiene_trades = len(db_trades_symbol(symbol)) > 0

            for o in ordenes:
                oid = str(o.get("orderId"))
                tipo = o.get("type", "")
                reduce_only = o.get("reduceOnly", False)

                # 1) orden que el bot NO rastrea -> zombi, cancelar
                if oid not in ids_legitimos:
                    cancelar_orden(symbol, oid)
                    log.info(f"🧹 {symbol}: cancelada orden huérfana {oid} ({tipo})")
                    continue

                # 2) SL real (reduceOnly) pero ya no hay posicion -> huerfano
                if reduce_only and not tiene_posicion:
                    cancelar_orden(symbol, oid)
                    log.info(f"🧹 {symbol}: cancelado SL huérfano {oid} (sin posición)")
                    continue

            # 3) si no hay posicion NI trades en DB, limpiar limites viejas de la DB
            if not tiene_posicion and not tiene_trades and db_limites_symbol(symbol):
                # las limites de la DB apuntan a ordenes que quizas ya no existen
                for l in db_limites_symbol(symbol):
                    if str(l["order_id"]) not in {str(o.get("orderId")) for o in ordenes}:
                        pass  # la orden ya no existe en Binance
                # si no hay ninguna posicion, las limites siguen validas (esperando llenarse)
                # no las borramos aca: refrescar_grid las gestiona

            time.sleep(0.2)
    except Exception as e:
        log.warning(f"[LIMPIADOR] {e}")


def monitor_limpieza():
    """Hilo que corre el limpiador cada 5 minutos."""
    log.info("🧹 Limpiador de órdenes iniciado")
    while True:
        try:
            if not modo_pausa:
                limpiar_ordenes_huerfanas()
        except Exception as e:
            log.warning(f"[LIMPIEZA] {e}")
        time.sleep(300)   # cada 5 minutos


def ciclo():
    """Refresca las limites de todos los activos (recalcula precios objetivo)."""
    for symbol in ACTIVOS:
        try:
            refrescar_grid(symbol)     # recalcular y reponer las limites
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"[CICLO] {symbol}: {e}")


def monitor_llenados():
    """
    Hilo rapido y dedicado: detecta llenados de limites y pone el SL real
    casi al instante. Corre mas seguido que el ciclo de refresco para que
    ninguna posicion quede sin SL real por mucho tiempo.
    """
    log.info("👁️ Monitor de llenados iniciado")
    while True:
        try:
            if not modo_pausa:
                for symbol in ACTIVOS:
                    # solo revisa activos que tienen limites puestas
                    if db_limites_symbol(symbol):
                        revisar_llenados(symbol)
            time.sleep(5)
        except Exception as e:
            log.warning(f"[LLENADOS] {e}")
            time.sleep(5)


def _tp_medio_desde_res(res):
    """El TP que usa el bot = 70% del MFE (columna tp_pct del auditor)."""
    return res["tp_pct"]


def correr_auditoria(universo=None, avisar_progreso=True):
    """
    Corre la auditoria sobre `universo` (o la lista vigente + candidatos).
    Arma la propuesta, la guarda, y avisa por Telegram las diferencias.
    """
    if universo is None:
        # lista vigente + candidatos sugeridos para ampliar
        candidatos = ["XTZUSDT","KSMUSDT","WAVESUSDT","ONTUSDT","IOTAUSDT",
                      "DGBUSDT","ZECUSDT","DASHUSDT","EOSUSDT","XLMUSDT"]
        universo = list(dict.fromkeys(ACTIVOS + candidatos))

    tg(f"🔍 <b>Auditoría iniciada</b> · {len(universo)} activos\nEsto tarda unos minutos...")
    log.info(f"🔍 Auditoria de {len(universo)} activos arrancando")

    def progreso(msg):
        if avisar_progreso:
            log.info(f"[AUDIT] {msg}")

    resultado = auto_auditor.auditar_universo(universo, dias=70, progreso=progreso)

    # armar la propuesta (nucleo + ampliacion, con su nivel/tp del auditor)
    propuesta = []
    for grupo in ("nucleo", "ampliacion"):
        for s in resultado[grupo]:
            r = resultado["detalle"][s]
            propuesta.append({"symbol": s, "base": r["nivel"], "apal": 25,
                              "tp_pct": _tp_medio_desde_res(r), "grupo": grupo})
    db_guardar_propuesta(propuesta)

    nuevos_syms = {p["symbol"] for p in propuesta}
    vigentes = set(ACTIVOS)
    entran = sorted(nuevos_syms - vigentes)
    salen  = sorted(vigentes - nuevos_syms)
    quedan = sorted(nuevos_syms & vigentes)

    # mensaje resumen
    def linea(s):
        r = resultado["detalle"].get(s)
        if not r:
            return f"• {s.replace('USDT','')}"
        return (f"• {s.replace('USDT','')} · RSI {int(r['nivel'])} · "
                f"ratio {r['ratio']} · exp {r['expect']}%")

    msg = ["📋 <b>AUDITORÍA COMPLETA</b>\n"]
    msg.append(f"Propuesta: <b>{len(propuesta)} activos</b> ({len(resultado['nucleo'])} núcleo + {len(resultado['ampliacion'])} ampliación)\n")
    if entran:
        msg.append("🟢 <b>ENTRAN:</b>")
        msg += [linea(s) for s in entran]
        msg.append("")
    if salen:
        msg.append("🔴 <b>SALEN:</b>")
        msg += [f"• {s.replace('USDT','')}" for s in salen]
        msg.append("")
    msg.append(f"✅ Se mantienen: {len(quedan)}")
    msg.append("\nPara aplicar: <b>/aplicar_lista</b>\nPara ignorar: no hagas nada")
    tg("\n".join(msg))
    log.info(f"🔍 Auditoria lista. Entran {len(entran)}, salen {len(salen)}, quedan {len(quedan)}")
    return resultado


def monitor_auditoria():
    """Hilo: corre la auditoria automatica cada ~60 dias."""
    log.info("📅 Auditoría automática programada (cada 60 días)")
    DIAS = 60
    # espera inicial larga: no audita al arranque (arranca con la lista vigente)
    esperado = 0
    while True:
        time.sleep(3600)  # chequea cada hora
        esperado += 1
        if esperado >= DIAS*24:
            try:
                tg("📅 <b>Auditoría automática de 60 días</b>")
                correr_auditoria()
            except Exception as e:
                log.warning(f"[AUDIT-AUTO] {e}")
            esperado = 0


def main():
    if not API_KEY or not API_SECRET:
        log.error("❌ Faltan credenciales"); return
    init_db()
    tg("🤖 <b>SNIPER RSI v2 iniciado</b>\n"
       f"Activos ({len(ACTIVOS)}): {', '.join(a.replace('USDT','') for a in ACTIVOS)}\n"
       f"Margen: {PCT_CAPITAL_USABLE*100:.0f}% del saldo · repartido en {SEÑALES_DISENO} señales de {GRID_ESCALONES} escalones\n"
       f"Grid: {GRID_ESCALONES} escalones · Entrada: límite pre-calculada\n"
       "Escribí /ayuda para los comandos")
    log.info("="*56)
    log.info("🚀 SNIPER RSI v2 — INICIADO")
    log.info(f"   Activos: {len(ACTIVOS)} · x25 aislado · grid {GRID_ESCALONES} escalones")
    log.info(f"   Capital: {PCT_CAPITAL_USABLE*100:.0f}% del saldo · salida 70/30 + trailing {TRAILING_DIST*100:.1f}%")
    log.info(f"   Hilos: TP/SL · llenados · limpieza · auditoría · telegram")
    log.info("="*56)

    threading.Thread(target=monitor_tp_sl, daemon=True).start()
    threading.Thread(target=monitor_llenados, daemon=True).start()
    threading.Thread(target=monitor_limpieza, daemon=True).start()
    threading.Thread(target=monitor_auditoria, daemon=True).start()
    threading.Thread(target=escuchar_telegram, daemon=True).start()

    # el ciclo refresca los precios objetivo de las limites cada ~30s
    while True:
        try:
            if not modo_pausa:
                ciclo()
        except Exception as e:
            log.error(f"[MAIN] {e}")
        time.sleep(30)


if __name__ == "__main__":
    main()
