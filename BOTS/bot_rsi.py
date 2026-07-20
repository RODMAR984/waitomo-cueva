#!/usr/bin/env python3
# ==========================================================
#  bot_rsi.py — SNIPER RSI v2 (edicion infraestructura)
#
#  Misma estrategia validada (niveles, TP, SL, grid, capital).
#  Cambios: operabilidad, RSI Wilder unificado, leverage seguro,
#  multi-escalon coherente, API/DB mas solidas. Sin spam de ordenes.
#
#  NO tocado a pedido: keys en codigo, filtro Telegram chat_id.
# ==========================================================

import os
import time
import math
import hmac
import hashlib
import sqlite3
import logging
import signal
import threading
import requests
import numpy as np
import pandas as pd
from logging.handlers import RotatingFileHandler
from threading import Lock, Event

import auditor_bot_rsi as auto_auditor  # mismo directorio

# ========= CREDENCIALES (sin cambios - pedido del usuario) =========
API_KEY        = "pyKAKvmsLXqNAj3QE6o0NHEzCTuua7zkGJeVmtLz2mUTSZeIzKeoceC08HCrmPNn"
API_SECRET     = "3onbAq90sL6EEVlZ6icuyUR3pAGGxhLdwuAP5PtvREpA2jQWcjXSDAMajJjYLxtl"
TELEGRAM_TOKEN = "8138670532:AAGADfDNotlIEmNLi9SY3tBn7DAdwFWIC4s"
TELEGRAM_CHAT  = "6900644047"

BASE_URL = "https://fapi.binance.com"
RECV_WINDOW = 5000
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_BASE_DIR, "sniper_rsi_v2.db")
LOG_PATH = os.path.join(_BASE_DIR, "sniper_rsi_v2.log")

# ========= ESTRATEGIA (validada - NO modificar) =========
TIMEFRAME = "5m"
RSI_LEN   = 14

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

TP_PCT = {
    "XMRUSDT": 1.37, "AVAXUSDT": 2.56, "ETCUSDT": 1.53, "ATOMUSDT": 2.66,
    "LTCUSDT": 1.83, "NEOUSDT": 2.12, "DOTUSDT": 2.37, "LINKUSDT": 1.96,
    "ICXUSDT": 2.59, "QTUMUSDT": 2.69, "ZILUSDT": 2.05, "VETUSDT": 2.56,
    "RVNUSDT": 2.56, "BABAUSDT": 1.82,
    "ENSUSDT": 2.58, "XVSUSDT": 2.31, "APTUSDT": 2.87,
}
SL_PCT = 3.7

GRID_ESCALONES = 4
GRID_PASO      = 3

TP_PARCIAL_PCT = 0.70
TRAILING_DIST  = 0.005

PCT_CAPITAL_USABLE = 0.70
SENALES_DISENO     = 5
MAX_POSIC_TOTALES  = 40
MIN_NOTIONAL_FALLBACK = 5.0

# Reintentos acotados (infra sin spam)
API_MAX_REINTENTOS = 3
SL_MAX_REINTENTOS = 2

# ========= ESTADO =========
db_lock = Lock()
leverage_lock = Lock()
leverage_cache = {}
margin_type_cache = {}
leverage_max_cache = {}
modo_pausa = Event()  # set() = pausado
_shutdown = Event()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s ? %(levelname)-7s ? %(message)s",
    datefmt="%H:%M:%S")
log = logging.getLogger("sniper_v2")


def _setup_file_log():
    try:
        fh = RotatingFileHandler(LOG_PATH, maxBytes=2_000_000, backupCount=3)
        fh.setFormatter(logging.Formatter(
            "%(asctime)s ? %(levelname)-7s ? %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
        log.addHandler(fh)
    except Exception as e:
        log.warning(f"[LOG-FILE] {e}")


# ==========================================================
#  TELEGRAM
# ==========================================================
def tg(msg: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={"chat_id": TELEGRAM_CHAT, "text": msg, "parse_mode": "HTML"},
            timeout=10)
    except Exception as e:
        log.warning(f"[TG] {e}")


# ==========================================================
#  BASE DE DATOS
# ==========================================================
def _conn():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=30000")
    return c


def _cargar_config_desde_db():
    global CONFIG, TP_PCT, ACTIVOS
    with db_lock:
        conn = _conn()
        conn.row_factory = sqlite3.Row
        filas = conn.execute("SELECT * FROM config_activos").fetchall()
        if not filas:
            for s, cfg in CONFIG.items():
                grupo = "nucleo" if s not in ("DOTUSDT", "LINKUSDT", "ENSUSDT", "APTUSDT") else "ampliacion"
                conn.execute(
                    "INSERT OR REPLACE INTO config_activos VALUES (?,?,?,?,?)",
                    (s, cfg["base"], cfg["apal"], TP_PCT.get(s, 2.0), grupo))
            conn.commit()
            filas = conn.execute("SELECT * FROM config_activos").fetchall()
        conn.close()
    CONFIG = {f["symbol"]: {"base": f["base"], "apal": int(f["apal"])} for f in filas}
    TP_PCT = {f["symbol"]: f["tp_pct"] for f in filas}
    ACTIVOS = list(CONFIG.keys())
    log.info(f" Config cargada: {len(ACTIVOS)} activos ({', '.join(a.replace('USDT','') for a in ACTIVOS)})")


def db_guardar_propuesta(propuesta):
    with db_lock:
        conn = _conn()
        conn.execute("DELETE FROM propuesta")
        for p in propuesta:
            conn.execute(
                "INSERT OR REPLACE INTO propuesta VALUES (?,?,?,?,?)",
                (p["symbol"], p["base"], p["apal"], p["tp_pct"], p["grupo"]))
        conn.commit()
        conn.close()


def db_leer_propuesta():
    with db_lock:
        conn = _conn()
        conn.row_factory = sqlite3.Row
        filas = conn.execute("SELECT * FROM propuesta").fetchall()
        conn.close()
    return filas


def aplicar_propuesta():
    filas = db_leer_propuesta()
    if not filas:
        return 0
    with db_lock:
        conn = _conn()
        conn.execute("DELETE FROM config_activos")
        for f in filas:
            conn.execute(
                "INSERT OR REPLACE INTO config_activos VALUES (?,?,?,?,?)",
                (f["symbol"], f["base"], f["apal"], f["tp_pct"], f["grupo"]))
        conn.commit()
        conn.close()
    _cargar_config_desde_db()
    return len(filas)


def init_db():
    with db_lock:
        conn = _conn()
        c = conn.cursor()
        c.execute("""CREATE TABLE IF NOT EXISTS trades (
            trade_id TEXT PRIMARY KEY, symbol TEXT, side TEXT, escalon INTEGER,
            qty REAL, precio_entrada REAL, tp REAL, sl REAL, apal INTEGER,
            order_id_sl TEXT, fase INTEGER DEFAULT 0, pico REAL DEFAULT 0,
            created_at REAL, fill_order_id TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS limites (
            symbol TEXT, side TEXT, escalon INTEGER, order_id TEXT, precio REAL,
            PRIMARY KEY (symbol, side, escalon))""")
        c.execute("""CREATE TABLE IF NOT EXISTS cierres (
            symbol TEXT, side TEXT, motivo TEXT, pnl REAL, timestamp REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS config_activos (
            symbol TEXT PRIMARY KEY, base REAL, apal INTEGER, tp_pct REAL, grupo TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS propuesta (
            symbol TEXT PRIMARY KEY, base REAL, apal INTEGER, tp_pct REAL, grupo TEXT)""")
        # migracion suave: columna fill_order_id si falta
        cols = [r[1] for r in c.execute("PRAGMA table_info(trades)").fetchall()]
        if "fill_order_id" not in cols:
            try:
                c.execute("ALTER TABLE trades ADD COLUMN fill_order_id TEXT")
            except Exception:
                pass
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_fill ON trades(fill_order_id) WHERE fill_order_id IS NOT NULL AND fill_order_id != ''")
        conn.commit()
        conn.close()
    _cargar_config_desde_db()
    _backup_db_suave()
    log.info("? DB v2 lista (WAL)")


def _backup_db_suave():
    """Copia ligera al arranque (1 archivo). No spamea."""
    try:
        if not os.path.exists(DB_PATH):
            return
        bak = DB_PATH + ".bak"
        import shutil
        shutil.copy2(DB_PATH, bak)
    except Exception as e:
        log.debug(f"[BACKUP] {e}")


def db_trades_symbol(symbol):
    with db_lock:
        conn = _conn()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM trades WHERE symbol=?", (symbol,)).fetchall()
        conn.close()
    return rows


def db_trades_all():
    with db_lock:
        conn = _conn()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM trades").fetchall()
        conn.close()
    return rows


def db_guardar_trade(t):
    with db_lock:
        conn = _conn()
        conn.execute("""INSERT OR REPLACE INTO trades
            (trade_id,symbol,side,escalon,qty,precio_entrada,tp,sl,apal,order_id_sl,fase,pico,created_at,fill_order_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (t["trade_id"], t["symbol"], t["side"], t["escalon"], t["qty"],
             t["precio_entrada"], t["tp"], t["sl"], t["apal"], t.get("order_id_sl", ""),
             t.get("fase", 0), t.get("pico", 0.0), time.time(), t.get("fill_order_id", "")))
        conn.commit()
        conn.close()


def db_trade_por_fill(fill_order_id):
    with db_lock:
        conn = _conn()
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM trades WHERE fill_order_id=?", (str(fill_order_id),)
        ).fetchone()
        conn.close()
    return row


def db_borrar_trade(trade_id):
    with db_lock:
        conn = _conn()
        conn.execute("DELETE FROM trades WHERE trade_id=?", (trade_id,))
        conn.commit()
        conn.close()


def db_registrar_cierre(symbol, side, motivo, pnl):
    with db_lock:
        conn = _conn()
        conn.execute(
            "INSERT INTO cierres (symbol,side,motivo,pnl,timestamp) VALUES (?,?,?,?,?)",
            (symbol, side, motivo, pnl, time.time()))
        conn.commit()
        conn.close()


def db_limites_symbol(symbol):
    with db_lock:
        conn = _conn()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM limites WHERE symbol=?", (symbol,)).fetchall()
        conn.close()
    return rows


def db_guardar_limite(symbol, side, escalon, order_id, precio):
    with db_lock:
        conn = _conn()
        conn.execute("""INSERT OR REPLACE INTO limites (symbol,side,escalon,order_id,precio)
                        VALUES (?,?,?,?,?)""", (symbol, side, escalon, order_id, precio))
        conn.commit()
        conn.close()


def db_borrar_limites(symbol):
    with db_lock:
        conn = _conn()
        conn.execute("DELETE FROM limites WHERE symbol=?", (symbol,))
        conn.commit()
        conn.close()


def db_borrar_limite(symbol, escalon, side=None):
    with db_lock:
        conn = _conn()
        if side:
            conn.execute(
                "DELETE FROM limites WHERE symbol=? AND escalon=? AND side=?",
                (symbol, escalon, side))
        else:
            conn.execute("DELETE FROM limites WHERE symbol=? AND escalon=?", (symbol, escalon))
        conn.commit()
        conn.close()


def db_borrar_limites_lado(symbol, side_keep):
    """Cancela en DB las limites cuyo lado != side_keep. Devuelve order_ids a cancelar."""
    with db_lock:
        conn = _conn()
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM limites WHERE symbol=? AND side!=?", (symbol, side_keep)
        ).fetchall()
        oids = [r["order_id"] for r in rows]
        conn.execute("DELETE FROM limites WHERE symbol=? AND side!=?", (symbol, side_keep))
        conn.commit()
        conn.close()
    return oids


# ==========================================================
#  BINANCE - helpers firmados (recvWindow + reintentos acotados)
# ==========================================================
_cache_exinfo = {"data": None, "expira": 0}


def _firmar(q):
    return hmac.new(API_SECRET.encode(), q.encode(), hashlib.sha256).hexdigest()


def _fmt_decimal(x):
    """Evita notacion cientifica en query strings."""
    if x is None:
        return "0"
    s = f"{float(x):.12f}".rstrip("0").rstrip(".")
    return s if s else "0"


def _signed_request(method, path, params=None, timeout=15):
    """
    Request firmado con recvWindow y hasta API_MAX_REINTENTOS ante 429/-1003/-1021.
    No spamea: backoff corto y tope duro de intentos.
    """
    params = dict(params or {})
    last_err = None
    for intento in range(API_MAX_REINTENTOS):
        try:
            params["timestamp"] = int(time.time() * 1000)
            params["recvWindow"] = RECV_WINDOW
            # construir query ordenada simple
            parts = []
            for k, v in params.items():
                if v is None:
                    continue
                parts.append(f"{k}={v}")
            q = "&".join(parts)
            sig = _firmar(q)
            url = f"{BASE_URL}{path}?{q}&signature={sig}"
            headers = {"X-MBX-APIKEY": API_KEY}
            if method == "GET":
                r = requests.get(url, headers=headers, timeout=timeout)
            elif method == "POST":
                r = requests.post(url, headers=headers, timeout=timeout)
            elif method == "DELETE":
                r = requests.delete(url, headers=headers, timeout=timeout)
            else:
                raise ValueError(method)

            if r.status_code == 429:
                time.sleep(1.0 + intento)
                last_err = f"429 {r.text[:120]}"
                continue
            try:
                body = r.json()
            except Exception:
                body = {"raw": r.text}
            if isinstance(body, dict) and body.get("code") in (-1003, -1021):
                time.sleep(0.8 + intento * 0.5)
                last_err = str(body)
                continue
            return r.status_code, body
        except Exception as e:
            last_err = e
            time.sleep(0.3 * (intento + 1))
    log.warning(f"[API] {method} {path} fallo tras reintentos: {last_err}")
    return None, {"error": str(last_err)}


def get_klines(symbol, limit=100):
    try:
        r = requests.get(
            f"{BASE_URL}/fapi/v1/klines",
            params={"symbol": symbol, "interval": TIMEFRAME, "limit": limit},
            timeout=10)
        if r.status_code == 429:
            time.sleep(1.0)
            return None
        r.raise_for_status()
        df = pd.DataFrame(r.json(), columns=[
            "open_time", "open", "high", "low", "close", "volume",
            "close_time", "qav", "trades", "tbb", "tbq", "ignore"])
        for col in ["open", "high", "low", "close"]:
            df[col] = df[col].astype(float)
        return df
    except Exception as e:
        log.warning(f"[KLINES] {symbol}: {e}")
        return None


def precio_mercado(symbol):
    try:
        r = requests.get(
            f"{BASE_URL}/fapi/v1/ticker/price",
            params={"symbol": symbol}, timeout=8)
        r.raise_for_status()
        return float(r.json()["price"])
    except Exception as e:
        log.warning(f"[PRECIO] {symbol}: {e}")
        return None


def balance_libre():
    code, body = _signed_request("GET", "/fapi/v2/balance")
    try:
        if code != 200 or not isinstance(body, list):
            return None
        for b in body:
            if b["asset"] == "USDT":
                return float(b["availableBalance"])
        return 0.0
    except Exception as e:
        log.warning(f"[BALANCE] {e}")
        return None


def saldo_total():
    code, body = _signed_request("GET", "/fapi/v2/balance")
    try:
        if code != 200 or not isinstance(body, list):
            return None
        for b in body:
            if b["asset"] == "USDT":
                return float(b["balance"])
        return 0.0
    except Exception as e:
        log.warning(f"[SALDO_TOTAL] {e}")
        return None


def margen_usado_total():
    code, body = _signed_request("GET", "/fapi/v2/positionRisk")
    try:
        if code != 200 or not isinstance(body, list):
            return None
        total = 0.0
        for p in body:
            amt = float(p.get("positionAmt", 0))
            if amt != 0:
                total += float(p.get("initialMargin", 0) or 0)
        return total
    except Exception as e:
        log.warning(f"[MARGEN] {e}")
        return None


def posiciones_abiertas():
    code, body = _signed_request("GET", "/fapi/v2/positionRisk")
    try:
        if code != 200 or not isinstance(body, list):
            return None
        return {
            p["symbol"]: float(p.get("positionAmt", 0))
            for p in body if float(p.get("positionAmt", 0)) != 0
        }
    except Exception as e:
        log.warning(f"[POSIC] {e}")
        return None


def verificar_one_way():
    """Al arranque: avisa si la cuenta esta en hedge (no aborta el bot)."""
    code, body = _signed_request("GET", "/fapi/v1/positionSide/dual")
    if code == 200 and isinstance(body, dict):
        dual = body.get("dualSidePosition")
        if dual is True or str(dual).lower() == "true":
            msg = ("Cuenta en HEDGE MODE. Este bot asume ONE-WAY. "
                   "Cambiala a One-way en Binance Futures para evitar fallos.")
            log.warning(msg)
            tg(f"<b>HEDGE MODE detectado</b>\n{msg}")
            return False
        log.info("? Position mode: ONE-WAY")
        return True
    log.warning("[MODE] No se pudo verificar positionSide/dual")
    return None


def _filtros(symbol):
    global _cache_exinfo
    ahora = time.time()
    if _cache_exinfo["data"] is None or ahora > _cache_exinfo["expira"]:
        r = requests.get(f"{BASE_URL}/fapi/v1/exchangeInfo", timeout=15)
        r.raise_for_status()
        _cache_exinfo["data"] = r.json()
        _cache_exinfo["expira"] = ahora + 3600
    sinfo = next((s for s in _cache_exinfo["data"]["symbols"] if s["symbol"] == symbol), None)
    if not sinfo:
        return None
    return {f["filterType"]: f for f in sinfo["filters"]}


def min_notional_symbol(symbol):
    try:
        f = _filtros(symbol)
        if not f:
            return MIN_NOTIONAL_FALLBACK
        mn = f.get("MIN_NOTIONAL") or f.get("NOTIONAL")
        if not mn:
            return MIN_NOTIONAL_FALLBACK
        for k in ("notional", "minNotional"):
            if k in mn:
                return float(mn[k])
        return MIN_NOTIONAL_FALLBACK
    except Exception:
        return MIN_NOTIONAL_FALLBACK


def ajustar_qty(symbol, qty):
    try:
        f = _filtros(symbol)
        if not f:
            return None
        lot = f.get("LOT_SIZE")
        step = float(lot["stepSize"])
        minq = float(lot["minQty"])
        prec = max(0, int(round(-math.log10(step)))) if step > 0 else 0
        q = round(math.floor(qty / step) * step, prec)
        return q if q >= minq and q > 0 else None
    except Exception as e:
        log.warning(f"[QTY] {symbol}: {e}")
        return None


def ajustar_precio(symbol, precio):
    try:
        f = _filtros(symbol)
        pf = f.get("PRICE_FILTER")
        tick = float(pf["tickSize"])
        prec = max(0, int(round(-math.log10(tick)))) if tick > 0 else 0
        return round(round(precio / tick) * tick, prec)
    except Exception as e:
        log.warning(f"[PRECIO_AJ] {symbol}: {e}")
        return precio


def _tick_size(symbol):
    try:
        f = _filtros(symbol)
        return float(f["PRICE_FILTER"]["tickSize"])
    except Exception:
        return 0.0001


# ==========================================================
#  RSI Wilder (alineado TradingView / Binance chart / auditor)
# ==========================================================
def rsi_wilder_serie(closes, n=RSI_LEN):
    arr = np.array(closes, dtype=float)
    if len(arr) < n + 2:
        return None
    d = np.diff(arr)
    g = np.where(d > 0, d, 0.0)
    p = np.where(d < 0, -d, 0.0)
    rsi = np.full(len(arr), np.nan)
    ag = g[:n].mean()
    ap = p[:n].mean()
    for i in range(n, len(g)):
        ag = (ag * (n - 1) + g[i]) / n
        ap = (ap * (n - 1) + p[i]) / n
        rs = ag / ap if ap > 0 else np.inf
        rsi[i + 1] = 100 - 100 / (1 + rs)
    return rsi


def precio_para_rsi(closes, rsi_objetivo, side, n=RSI_LEN):
    """
    closes: velas CERRADAS (sin la vela en curso).
    side: BUY (RSI baja) o SELL (RSI sube).
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
        ag = (ag * (n - 1) + gains[i]) / n
        al = (al * (n - 1) + losses[i]) / n

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
    return P if P and P > 0 and math.isfinite(P) else None


def niveles_grid_rsi(symbol, side):
    base = CONFIG[symbol]["base"]
    if side == "BUY":
        return [base - i * GRID_PASO for i in range(GRID_ESCALONES)]
    short = 100 - base
    return [short + i * GRID_PASO for i in range(GRID_ESCALONES)]


def calcular_rsi_actual(df):
    """
    RSI Wilder incluyendo la vela en curso (solo para decidir lado BUY/SELL).
    Misma familia que precio_para_rsi / TradingView / auto_auditor.
    """
    if df is None or len(df) < RSI_LEN + 2:
        return None
    serie = rsi_wilder_serie(df["close"].tolist())
    if serie is None:
        return None
    val = serie[-1]
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return float(val)


# ==========================================================
#  BINANCE - escritura
# ==========================================================
def max_leverage_permitido(symbol):
    """Lee brackets (cache 1h). Fallback 25 si falla la API."""
    ahora = time.time()
    cached = leverage_max_cache.get(symbol)
    if cached and ahora < cached["expira"]:
        return cached["max"]
    code, body = _signed_request("GET", "/fapi/v1/leverageBracket", {"symbol": symbol})
    mx = 25
    try:
        if code == 200:
            # formato: [{"symbol":"X","brackets":[{"initialLeverage":...}, ...]}]
            data = body
            if isinstance(data, list) and data:
                brackets = data[0].get("brackets") or data[0].get("bracket") or []
                levs = [int(b.get("initialLeverage", 0)) for b in brackets]
                if levs:
                    mx = max(levs)
            elif isinstance(data, dict) and "brackets" in data:
                levs = [int(b.get("initialLeverage", 0)) for b in data["brackets"]]
                if levs:
                    mx = max(levs)
    except Exception as e:
        log.warning(f"[LEV-MAX] {symbol}: {e}")
    leverage_max_cache[symbol] = {"max": mx, "expira": ahora + 3600}
    return mx


def apal_efectivo(symbol, apal_deseado=None):
    deseado = apal_deseado if apal_deseado is not None else CONFIG[symbol]["apal"]
    return max(1, min(int(deseado), int(max_leverage_permitido(symbol))))


def set_isolated(symbol):
    if margin_type_cache.get(symbol):
        return True
    code, body = _signed_request(
        "POST", "/fapi/v1/marginType",
        {"symbol": symbol, "marginType": "ISOLATED"})
    # -4046 = ya isolated
    if code == 200 or (isinstance(body, dict) and body.get("code") == -4046):
        margin_type_cache[symbol] = True
        return True
    log.warning(f"[ISOLATED] {symbol}: {body}")
    return False


def fijar_leverage(symbol, apal):
    apal = apal_efectivo(symbol, apal)
    ahora = time.time()
    with leverage_lock:
        ci = leverage_cache.get(symbol)
        if ci and ahora < ci["expira"] and ci["lev"] == apal:
            return True
    code, body = _signed_request(
        "POST", "/fapi/v1/leverage",
        {"symbol": symbol, "leverage": apal})
    if code == 200:
        with leverage_lock:
            leverage_cache[symbol] = {"lev": apal, "expira": ahora + 6 * 3600}
        return True
    log.warning(f"[LEV] {symbol} x{apal}: {body}")
    return False


def orden_limite(symbol, side, qty, precio, apal):
    try:
        set_isolated(symbol)
        fijar_leverage(symbol, apal)
        precio = ajustar_precio(symbol, precio)
        qty_s = _fmt_decimal(qty)
        precio_s = _fmt_decimal(precio)
        ts = int(time.time() * 1000)
        coid = f"grid_{symbol}_{side}_{ts}"
        code, body = _signed_request("POST", "/fapi/v1/order", {
            "symbol": symbol,
            "side": side,
            "type": "LIMIT",
            "timeInForce": "GTC",
            "quantity": qty_s,
            "price": precio_s,
            "newClientOrderId": coid,
        })
        if code == 200 and isinstance(body, dict) and body.get("orderId"):
            return str(body["orderId"])
        log.warning(f"[LIMIT] {symbol}: {body}")
        return None
    except Exception as e:
        log.warning(f"[LIMIT] {symbol}: {e}")
        return None


def orden_market(symbol, side, qty, apal, reduce_only=False):
    try:
        if not reduce_only:
            set_isolated(symbol)
            fijar_leverage(symbol, apal)
        qty_s = _fmt_decimal(qty)
        params = {
            "symbol": symbol,
            "side": side,
            "type": "MARKET",
            "quantity": qty_s,
        }
        if reduce_only:
            params["reduceOnly"] = "true"
        code, body = _signed_request("POST", "/fapi/v1/order", params)
        if code == 200 and isinstance(body, dict):
            return body
        log.warning(f"[MARKET] {symbol}: {body}")
        return None
    except Exception as e:
        log.warning(f"[MARKET] {symbol}: {e}")
        return None


def poner_stop_real(symbol, side_pos, qty, sl_precio, apal):
    """
    SL STOP_MARKET. Reintentos ACOTADOS (SL_MAX_REINTENTOS).
    No spamea: si falla, None y el monitor mantiene SL virtual.
    """
    lado = "SELL" if side_pos == "BUY" else "BUY"
    stop = ajustar_precio(symbol, sl_precio)
    qty_s = _fmt_decimal(qty)
    stop_s = _fmt_decimal(stop)
    for intento in range(SL_MAX_REINTENTOS):
        try:
            code, body = _signed_request("POST", "/fapi/v1/order", {
                "symbol": symbol,
                "side": lado,
                "type": "STOP_MARKET",
                "stopPrice": stop_s,
                "quantity": qty_s,
                "reduceOnly": "true",
                "workingType": "CONTRACT_PRICE",
            })
            if code == 200 and isinstance(body, dict) and body.get("orderId"):
                return str(body["orderId"])
            log.warning(f"[SL] {symbol} intento {intento+1}: {body}")
            time.sleep(0.4)
        except Exception as e:
            log.warning(f"[SL] {symbol}: {e}")
            time.sleep(0.4)
    return None


def cancelar_orden(symbol, order_id):
    try:
        code, body = _signed_request("DELETE", "/fapi/v1/order", {
            "symbol": symbol, "orderId": order_id})
        if code not in (200, None) and isinstance(body, dict) and body.get("code") not in (-2011,):
            log.debug(f"[CANCEL] {symbol} {order_id}: {body}")
    except Exception as e:
        log.debug(f"[CANCEL] {symbol}: {e}")


def cancelar_todas(symbol):
    try:
        code, body = _signed_request("DELETE", "/fapi/v1/allOpenOrders", {"symbol": symbol})
        if code not in (200, None):
            log.debug(f"[CANCEL-ALL] {symbol}: {body}")
    except Exception as e:
        log.debug(f"[CANCEL-ALL] {symbol}: {e}")


def estado_orden(symbol, order_id):
    try:
        code, body = _signed_request("GET", "/fapi/v1/order", {
            "symbol": symbol, "orderId": order_id})
        if code == 200 and isinstance(body, dict):
            return (
                body.get("status"),
                float(body.get("avgPrice") or 0),
                float(body.get("executedQty") or 0),
            )
        return None, 0, 0
    except Exception:
        return None, 0, 0


# ==========================================================
#  TAMANO DE POSICION (misma formula de estrategia)
# ==========================================================
def margen_max_actual():
    st = saldo_total()
    if st is None:
        return None
    return st * PCT_CAPITAL_USABLE


def calcular_qty_escalon(symbol, precio_entrada, apal):
    mmax = margen_max_actual()
    if mmax is None or mmax <= 0:
        return None
    apal = apal_efectivo(symbol, apal)
    margen_por_senal = mmax / SENALES_DISENO
    margen_escalon = margen_por_senal / GRID_ESCALONES
    notional_escalon = margen_escalon * apal
    min_n = min_notional_symbol(symbol)
    if notional_escalon < min_n:
        notional_escalon = min_n
    qty = ajustar_qty(symbol, notional_escalon / precio_entrada)
    if qty is None:
        return None
    # revalidar notional real
    if qty * precio_entrada < min_n * 0.99:
        qty2 = ajustar_qty(symbol, (min_n * 1.01) / precio_entrada)
        return qty2
    return qty


# ==========================================================
#  GRID
# ==========================================================
def refrescar_grid(symbol):
    if modo_pausa.is_set():
        return

    df = get_klines(symbol, 100)
    if df is None or len(df) < RSI_LEN + 3:
        return
    # velas cerradas para precio objetivo (Wilder)
    closes = df["close"].iloc[:-1].tolist()

    trades_abiertos = db_trades_symbol(symbol)
    abiertos = len(trades_abiertos)
    if abiertos >= GRID_ESCALONES:
        return

    if abiertos > 0:
        side = trades_abiertos[0]["side"]
    else:
        rsi_actual = calcular_rsi_actual(df)
        if rsi_actual is None:
            return
        side = "BUY" if rsi_actual <= 50 else "SELL"

    # cancelar limites del lado opuesto (sin mezclar long/short)
    oids_opp = db_borrar_limites_lado(symbol, side)
    for oid in oids_opp:
        cancelar_orden(symbol, oid)

    apal = apal_efectivo(symbol)
    niveles = niveles_grid_rsi(symbol, side)

    mtot = margen_usado_total()
    mmax = margen_max_actual()
    if mtot is not None and mmax is not None and mtot >= mmax:
        return
    if len(db_trades_all()) >= MAX_POSIC_TOTALES:
        return

    limites_actuales = {l["escalon"]: l for l in db_limites_symbol(symbol) if l["side"] == side}

    precio_actual = precio_mercado(symbol)
    if not precio_actual:
        return
    tick = _tick_size(symbol)

    for esc in range(abiertos, GRID_ESCALONES):
        nivel_rsi = niveles[esc]
        precio_obj = precio_para_rsi(closes, nivel_rsi, side)
        if not precio_obj:
            continue
        if side == "BUY" and precio_obj >= precio_actual:
            continue
        if side == "SELL" and precio_obj <= precio_actual:
            continue

        lim_vieja = limites_actuales.get(esc)
        if lim_vieja and abs(float(lim_vieja["precio"]) - precio_obj) < tick * 2:
            continue

        if lim_vieja:
            cancelar_orden(symbol, lim_vieja["order_id"])
        qty = calcular_qty_escalon(symbol, precio_obj, apal)
        if not qty:
            continue
        oid = orden_limite(symbol, side, qty, precio_obj, apal)
        if oid:
            db_guardar_limite(symbol, side, esc, oid, precio_obj)


# ==========================================================
#  LLENADOS (idempotente por fill_order_id)
# ==========================================================
def revisar_llenados(symbol):
    limites = db_limites_symbol(symbol)
    for lim in limites:
        oid = str(lim["order_id"])
        # ya registrado? (race)
        if db_trade_por_fill(oid):
            db_borrar_limite(symbol, lim["escalon"], lim["side"])
            continue

        status, avg_price, exec_qty = estado_orden(symbol, oid)
        if status == "FILLED":
            # marcar limite fuera ANTES de abrir trade (reduce race)
            db_borrar_limite(symbol, lim["escalon"], lim["side"])
            if db_trade_por_fill(oid):
                continue

            side = lim["side"]
            escalon = lim["escalon"]
            precio_exec = avg_price if avg_price > 0 else float(lim["precio"])
            apal = apal_efectivo(symbol)

            tp_p = TP_PCT[symbol] / 100.0
            sl_p = SL_PCT / 100.0
            if side == "BUY":
                tp = precio_exec * (1 + tp_p)
                sl = precio_exec * (1 - sl_p)
            else:
                tp = precio_exec * (1 - tp_p)
                sl = precio_exec * (1 + sl_p)

            sl_oid = poner_stop_real(symbol, side, exec_qty, sl, apal)
            trade_id = f"{symbol}_{oid}"
            db_guardar_trade({
                "trade_id": trade_id,
                "symbol": symbol,
                "side": side,
                "escalon": escalon + 1,  # display 1-based (igual que antes)
                "qty": exec_qty,
                "precio_entrada": precio_exec,
                "tp": tp,
                "sl": sl,
                "apal": apal,
                "order_id_sl": sl_oid or "",
                "fill_order_id": oid,
            })

            tag = "LONG" if side == "BUY" else "SHORT"
            aviso_sl = "" if sl_oid else (
                "\n<b>SL real no puesto</b> (queda SL virtual del monitor; "
                "sin spam de reintentos)")
            tg(
                f"<b>{symbol}</b> {tag} {side} escalon {escalon+1}/{GRID_ESCALONES}\n"
                f"Entrada: <b>{precio_exec:.5f}</b>\n"
                f"TP: {tp:.5f} ({TP_PCT[symbol]}%)  |  SL: {sl:.5f} ({SL_PCT}%)\n"
                f"Qty: {exec_qty}  lev x{apal}{aviso_sl}")
            log.info(f"OK {symbol} {side} E{escalon+1} @ {precio_exec} x{apal}")
        elif status in ("CANCELED", "EXPIRED", "REJECTED"):
            db_borrar_limite(symbol, lim["escalon"], lim["side"])


# ==========================================================
#  MONITOR TP / SL (multi-escalon: reserva qty por simbolo)
# ==========================================================
def monitor_tp_sl():
    log.info("Monitor TP/SL iniciado")
    while not _shutdown.is_set():
        try:
            trades = db_trades_all()
            if not trades:
                time.sleep(3)
                continue
            pos = posiciones_abiertas()
            if pos is None:
                time.sleep(3)
                continue

            # agrupar por symbol para repartir qty disponible sin solaparse
            by_sym = {}
            for t in trades:
                by_sym.setdefault(t["symbol"], []).append(t)

            for symbol, lista in by_sym.items():
                if symbol not in pos:
                    for t in lista:
                        db_borrar_trade(t["trade_id"])
                        db_registrar_cierre(symbol, t["side"], "EXTERNO", 0.0)
                    tg(f"<b>{symbol}</b> cerrado por fuera del bot (SL real o manual)")
                    continue

                precio = precio_mercado(symbol)
                if not precio:
                    continue

                disponible = abs(float(pos[symbol]))
                # orden estable por escalon
                lista_ord = sorted(lista, key=lambda x: int(x["escalon"] or 0))

                for t in lista_ord:
                    if disponible <= 0:
                        break
                    side = t["side"]
                    tp = float(t["tp"])
                    sl = float(t["sl"])
                    qty = float(t["qty"])
                    ent = float(t["precio_entrada"])
                    apal = int(t["apal"])
                    fase = int(t["fase"] or 0)
                    pico = float(t["pico"] or 0.0)
                    cierre = "SELL" if side == "BUY" else "BUY"
                    # no pedir mas de lo que queda en el exchange para este lote
                    qty_cap = min(qty, disponible)

                    toca_sl = (side == "BUY" and precio <= sl) or (side == "SELL" and precio >= sl)

                    if toca_sl:
                        q = ajustar_qty(symbol, qty_cap)
                        if not q:
                            db_borrar_trade(t["trade_id"])
                            continue
                        res = orden_market(symbol, cierre, q, apal, reduce_only=True)
                        if not res:
                            continue
                        salida = float(res.get("avgPrice") or precio)
                        pnl = (salida - ent) * q if side == "BUY" else (ent - salida) * q
                        if t["order_id_sl"]:
                            cancelar_orden(symbol, t["order_id_sl"])
                        db_borrar_trade(t["trade_id"])
                        db_registrar_cierre(symbol, side, "SL", pnl)
                        disponible = max(0.0, disponible - q)
                        tg(
                            f"<b>{symbol}</b> SL escalon {t['escalon']}\n"
                            f"Entrada {ent:.5f} ? Salida {salida:.5f}\n"
                            f"PnL: <b>{pnl:+.2f} USDT</b>")
                        log.info(f"{symbol} SL PnL {pnl:+.2f}")
                        continue

                    if fase == 0:
                        toca_tp = (side == "BUY" and precio >= tp) or (side == "SELL" and precio <= tp)
                        if not toca_tp:
                            continue
                        q_parcial = ajustar_qty(symbol, min(qty * TP_PARCIAL_PCT, qty_cap))
                        if not q_parcial:
                            continue
                        res = orden_market(symbol, cierre, q_parcial, apal, reduce_only=True)
                        if not res:
                            continue
                        salida = float(res.get("avgPrice") or precio)
                        pnl = (salida - ent) * q_parcial if side == "BUY" else (ent - salida) * q_parcial
                        resto = max(0.0, qty - q_parcial)
                        with db_lock:
                            conn = _conn()
                            conn.execute(
                                "UPDATE trades SET fase=1, pico=?, qty=? WHERE trade_id=?",
                                (precio, resto, t["trade_id"]))
                            conn.commit()
                            conn.close()
                        disponible = max(0.0, disponible - q_parcial)
                        db_registrar_cierre(symbol, side, "TP_PARCIAL", pnl)
                        tg(
                            f"<b>{symbol}</b> TP parcial (70%) escalon {t['escalon']}\n"
                            f"Entrada {ent:.5f} ? Salida {salida:.5f}\n"
                            f"PnL parcial: <b>{pnl:+.2f} USDT</b>\n"
                            f"30% restante corriendo con trailing {TRAILING_DIST*100:.1f}%")
                        log.info(f"{symbol} TP parcial PnL {pnl:+.2f}")
                        continue

                    # FASE 1 trailing
                    if side == "BUY":
                        nuevo_pico = max(pico, precio) if pico > 0 else precio
                        retroceso = (nuevo_pico - precio) / nuevo_pico if nuevo_pico > 0 else 0
                    else:
                        nuevo_pico = min(pico, precio) if pico > 0 else precio
                        retroceso = (precio - nuevo_pico) / nuevo_pico if nuevo_pico > 0 else 0

                    if nuevo_pico != pico:
                        with db_lock:
                            conn = _conn()
                            conn.execute(
                                "UPDATE trades SET pico=? WHERE trade_id=?",
                                (nuevo_pico, t["trade_id"]))
                            conn.commit()
                            conn.close()

                    if retroceso >= TRAILING_DIST:
                        q = ajustar_qty(symbol, qty_cap)
                        if not q:
                            db_borrar_trade(t["trade_id"])
                            continue
                        res = orden_market(symbol, cierre, q, apal, reduce_only=True)
                        if not res:
                            continue
                        salida = float(res.get("avgPrice") or precio)
                        pnl = (salida - ent) * q if side == "BUY" else (ent - salida) * q
                        if t["order_id_sl"]:
                            cancelar_orden(symbol, t["order_id_sl"])
                        db_borrar_trade(t["trade_id"])
                        db_registrar_cierre(symbol, side, "TRAILING", pnl)
                        disponible = max(0.0, disponible - q)
                        tg(
                            f"<b>{symbol}</b> trailing cerro el 30% escalon {t['escalon']}\n"
                            f"Entrada {ent:.5f} ? Salida {salida:.5f} (pico {nuevo_pico:.5f})\n"
                            f"PnL resto: <b>{pnl:+.2f} USDT</b>")
                        log.info(f"{symbol} trailing PnL {pnl:+.2f}")

            time.sleep(2)
        except Exception as e:
            log.warning(f"[MONITOR] {e}")
            time.sleep(5)


# ==========================================================
#  TELEGRAM - comandos (sin filtro chat - pedido del usuario)
# ==========================================================
def escuchar_telegram():
    if not TELEGRAM_TOKEN:
        return
    offset = 0
    while not _shutdown.is_set():
        try:
            r = requests.get(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates",
                params={"offset": offset + 1, "timeout": 30}, timeout=40)
            for upd in r.json().get("result", []):
                offset = upd["update_id"]
                txt = (upd.get("message", {}).get("text") or "").strip().lower()
                if txt == "/pausa":
                    modo_pausa.set()
                    for s in ACTIVOS:
                        cancelar_todas(s)
                        db_borrar_limites(s)
                    tg("<b>PAUSA</b>  limites canceladas, no abre nuevas (las posiciones siguen)")
                elif txt == "/seguir":
                    modo_pausa.clear()
                    tg("<b>ACTIVO</b>")
                elif txt == "/estado":
                    bal = balance_libre()
                    mtot = margen_usado_total()
                    mmax = margen_max_actual()
                    trades = db_trades_all()
                    bal_txt = f"{bal:.2f}" if bal is not None else "N/D"
                    mtot_txt = f"{mtot:.2f}" if mtot is not None else "N/D"
                    mmax_txt = f"{mmax:.2f}" if mmax is not None else "N/D"
                    pos_txt = "\n".join(
                        f"- {t['symbol']} {t['side']} E{t['escalon']} @ {t['precio_entrada']:.5f}"
                        for t in trades) or "sin posiciones"
                    tg(
                        f"<b>ESTADO</b>\n"
                        f"Balance libre: {bal_txt} USDT\n"
                        f"Margen usado: {mtot_txt} / {mmax_txt} USDT (70% del saldo)\n"
                        f"Pausa: {'si' if modo_pausa.is_set() else 'no'}\n"
                        f"Posiciones ({len(trades)}):\n{pos_txt}")
                elif txt == "/cerrar":
                    n = 0
                    for t in db_trades_all():
                        cierre = "SELL" if t["side"] == "BUY" else "BUY"
                        if orden_market(t["symbol"], cierre, float(t["qty"]), int(t["apal"]), reduce_only=True):
                            if t["order_id_sl"]:
                                cancelar_orden(t["symbol"], t["order_id_sl"])
                            db_borrar_trade(t["trade_id"])
                            n += 1
                    for s in ACTIVOS:
                        cancelar_todas(s)
                        db_borrar_limites(s)
                    tg(f"Cerradas {n} posiciones y canceladas todas las limites")
                elif txt == "/auditar":
                    tg("Arrancando auditoria manual (tarda unos minutos)...")
                    threading.Thread(target=correr_auditoria, daemon=True).start()
                elif txt == "/aplicar_lista":
                    n = aplicar_propuesta()
                    if n > 0:
                        for s in list(ACTIVOS):
                            cancelar_todas(s)
                            db_borrar_limites(s)
                        tg(
                            f"? <b>Lista aplicada</b>: {n} activos ahora vigentes.\n"
                            f"{', '.join(a.replace('USDT','') for a in ACTIVOS)}\n"
                            "Limites viejas canceladas, se rearman con la nueva config.")
                    else:
                        tg("No hay ninguna propuesta pendiente. Corre /auditar primero.")
                elif txt in ("/ayuda", "/help", "/start"):
                    tg(
                        "<b>SNIPER RSI v2</b> (infra)\n"
                        "/estado  balance, margen y posiciones\n"
                        "/pausa  cancela limites, no abre nuevas\n"
                        "/seguir  reactiva\n"
                        "/cerrar  cierra todo a mercado\n"
                        "/auditar  corre la auditoria de activos ahora\n"
                        "/aplicar_lista  aplica la ultima propuesta de auditoria")
        except Exception as e:
            log.warning(f"[TG-LISTEN] {e}")
            time.sleep(5)


# ==========================================================
#  LIMPIEZA / LOOPS
# ==========================================================
def limpiar_ordenes_huerfanas():
    try:
        pos = posiciones_abiertas()
        if pos is None:
            return
        for symbol in ACTIVOS:
            try:
                code, body = _signed_request("GET", "/fapi/v1/openOrders", {"symbol": symbol})
                if code != 200 or not isinstance(body, list):
                    continue
                ordenes = body
            except Exception:
                continue
            if not ordenes:
                continue

            ids_limites = {str(l["order_id"]) for l in db_limites_symbol(symbol)}
            ids_sl = {str(t["order_id_sl"]) for t in db_trades_symbol(symbol) if t["order_id_sl"]}
            ids_legitimos = ids_limites | ids_sl
            tiene_posicion = symbol in pos

            for o in ordenes:
                oid = str(o.get("orderId"))
                tipo = o.get("type", "")
                reduce_only = o.get("reduceOnly", False)
                if oid not in ids_legitimos:
                    cancelar_orden(symbol, oid)
                    log.info(f"CLEAN {symbol}: cancelada orden hurfana {oid} ({tipo})")
                    continue
                if reduce_only and not tiene_posicion:
                    cancelar_orden(symbol, oid)
                    log.info(f"CLEAN {symbol}: cancelado SL hurfano {oid}")
            time.sleep(0.2)
    except Exception as e:
        log.warning(f"[LIMPIADOR] {e}")


def monitor_limpieza():
    log.info("CLEAN Limpiador de ordenes iniciado")
    while not _shutdown.is_set():
        try:
            if not modo_pausa.is_set():
                limpiar_ordenes_huerfanas()
        except Exception as e:
            log.warning(f"[LIMPIEZA] {e}")
        _shutdown.wait(300)


def ciclo():
    for symbol in list(ACTIVOS):
        if _shutdown.is_set():
            break
        try:
            refrescar_grid(symbol)
            time.sleep(0.3)
        except Exception as e:
            log.warning(f"[CICLO] {symbol}: {e}")


def monitor_llenados():
    log.info("Monitor de llenados iniciado")
    while not _shutdown.is_set():
        try:
            if not modo_pausa.is_set():
                for symbol in list(ACTIVOS):
                    if db_limites_symbol(symbol):
                        revisar_llenados(symbol)
            time.sleep(5)
        except Exception as e:
            log.warning(f"[LLENADOS] {e}")
            time.sleep(5)


def _tp_medio_desde_res(res):
    return res["tp_pct"]


def correr_auditoria(universo=None, avisar_progreso=True):
    if universo is None:
        candidatos = [
            "XTZUSDT", "KSMUSDT", "WAVESUSDT", "ONTUSDT", "IOTAUSDT",
            "DGBUSDT", "ZECUSDT", "DASHUSDT", "EOSUSDT", "XLMUSDT"]
        universo = list(dict.fromkeys(ACTIVOS + candidatos))

    tg(f"<b>Auditoria iniciada</b>  {len(universo)} activos\nEsto tarda unos minutos...")
    log.info(f"AUDIT Auditoria de {len(universo)} activos arrancando")

    def progreso(msg):
        if avisar_progreso:
            log.info(f"[AUDIT] {msg}")

    resultado = auto_auditor.auditar_universo(universo, dias=70, progreso=progreso)

    propuesta = []
    for grupo in ("nucleo", "ampliacion"):
        for s in resultado.get(grupo, []):
            r = resultado["detalle"][s]
            if not r or r.get("error"):
                continue
            # apal deseado 25, el bot aplica min(25, max del simbolo) al operar
            propuesta.append({
                "symbol": s,
                "base": r["nivel"],
                "apal": 25,
                "tp_pct": _tp_medio_desde_res(r),
                "grupo": grupo,
            })
    db_guardar_propuesta(propuesta)

    nuevos_syms = {p["symbol"] for p in propuesta}
    vigentes = set(ACTIVOS)
    entran = sorted(nuevos_syms - vigentes)
    salen = sorted(vigentes - nuevos_syms)
    quedan = sorted(nuevos_syms & vigentes)

    def linea(s):
        r = resultado["detalle"].get(s)
        if not r or r.get("error"):
            return f"- {s.replace('USDT','')}"
        return (
            f"- {s.replace('USDT','')} | RSI {int(r['nivel'])}  "
            f"ratio {r['ratio']}  exp {r['expect']}%")

    msg = ["<b>AUDITORA COMPLETA</b>\n"]
    msg.append(
        f"Propuesta: <b>{len(propuesta)} activos</b> "
        f"({len(resultado.get('nucleo', []))} nucleo + "
        f"{len(resultado.get('ampliacion', []))} ampliacion)\n")
    if entran:
        msg.append("<b>ENTRAN:</b>")
        msg += [linea(s) for s in entran]
        msg.append("")
    if salen:
        msg.append("<b>SALEN:</b>")
        msg += [f"- {s.replace('USDT','')}" for s in salen]
        msg.append("")
    msg.append(f"? Se mantienen: {len(quedan)}")
    msg.append("\nPara aplicar: <b>/aplicar_lista</b>\nPara ignorar: no hagas nada")
    tg("\n".join(msg))
    log.info(f"AUDIT Auditoria lista. Entran {len(entran)}, salen {len(salen)}, quedan {len(quedan)}")
    return resultado


def monitor_auditoria():
    log.info("AUDIT Auditoria automatica programada (cada 60 dias)")
    DIAS = 60
    esperado = 0
    while not _shutdown.is_set():
        _shutdown.wait(3600)
        if _shutdown.is_set():
            break
        esperado += 1
        if esperado >= DIAS * 24:
            try:
                tg("<b>Auditoria automatica de 60 dias</b>")
                correr_auditoria()
            except Exception as e:
                log.warning(f"[AUDIT-AUTO] {e}")
            esperado = 0


def _on_signal(signum, frame):
    log.info(f"Seal {signum}: apagado graceful")
    modo_pausa.set()
    _shutdown.set()


def main():
    if not API_KEY or not API_SECRET:
        log.error("? Faltan credenciales")
        return
    _setup_file_log()
    init_db()
    verificar_one_way()

    try:
        signal.signal(signal.SIGTERM, _on_signal)
        signal.signal(signal.SIGINT, _on_signal)
    except Exception:
        pass

    tg(
        "<b>SNIPER RSI v2 iniciado</b> (infra)\n"
        f"Activos ({len(ACTIVOS)}): {', '.join(a.replace('USDT','') for a in ACTIVOS)}\n"
        f"Margen: {PCT_CAPITAL_USABLE*100:.0f}% del saldo  "
        f"repartido en {SENALES_DISENO} senales de {GRID_ESCALONES} escalones\n"
        f"Grid: {GRID_ESCALONES} escalones  RSI Wilder  lev <= max del par\n"
        "Escribi /ayuda para los comandos")
    log.info("=" * 56)
    log.info("START SNIPER RSI v2 - INICIADO (infra)")
    log.info(f"   DB: {DB_PATH}")
    log.info(f"   Activos: {len(ACTIVOS)}  grid {GRID_ESCALONES}  Wilder RSI")
    log.info("=" * 56)

    threading.Thread(target=monitor_tp_sl, daemon=True).start()
    threading.Thread(target=monitor_llenados, daemon=True).start()
    threading.Thread(target=monitor_limpieza, daemon=True).start()
    threading.Thread(target=monitor_auditoria, daemon=True).start()
    threading.Thread(target=escuchar_telegram, daemon=True).start()

    while not _shutdown.is_set():
        try:
            if not modo_pausa.is_set():
                ciclo()
        except Exception as e:
            log.error(f"[MAIN] {e}")
        _shutdown.wait(30)

    log.info("Apagado limpio")


if __name__ == "__main__":
    main()
