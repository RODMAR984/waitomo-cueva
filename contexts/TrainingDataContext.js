// contexts/TrainingDataContext.js — Waitomo refactor (funcionalidad preservada)
// - No UI, sin colores literales ni estilos (dark-only coherente por normas)
// - Hidratación igual que el original, con AsyncStorage
// - Todas las funciones públicas memoizadas con useCallback
// - value del Provider memoizado con useMemo para evitar renders innecesarios

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import {
  mergeRemoteTrainingBlocks,
  syncTrainingBlocksToSupabase,
  fetchTrainingBlocksForOrg,
} from '../utils/trainingBlocksSupabase';
import { calculateWeightFromRm } from '../utils/rmPattern';
import { resolveTrainingBlocksOrgId } from '../utils/resolveTrainingBlocksOrgId';
import {
  upsertBillingPaymentRow,
  upsertBillingSubscriptionRow,
  fetchBillingPaymentsForOrg,
  fetchBillingSubscriptionsForOrg,
  paymentRowToLocal,
  subscriptionRowToLocal,
} from '../services/billing/billingRecords';

const TrainingDataContext = createContext(null);

const STORAGE_KEYS = {
  BLOQUES: 'tdc_bloques',
  USER_NOTES: 'tdc_user_notes',
  RMS: 'tdc_rms',
  PAYMENTS: 'tdc_payments',
  SUBSCRIPTIONS: 'tdc_subscriptions',
  LEDGER: 'tdc_ledger',
  CAJA_INICIAL: 'tdc_caja_inicial',
  CATEGORIES: 'tdc_categories',
};

export function TrainingDataProvider({ children }) {
  // ======= Estado =======
  const [hydrated, setHydrated] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // bloques del día
  const [bloques, setBloques] = useState([]);
  // notas de usuario
  const [userNotes, setUserNotes] = useState({});
  // RMs por ejercicio
  const [rms, setRms] = useState({});

  // pagos / suscripciones
  const [payments, setPayments] = useState({});
  const [subscriptions, setSubscriptions] = useState({});

  // libro diario (caja)
  const [ledger, setLedger] = useState({});
  // caja inicial por fecha (YYYY-MM-DD => monto)
  const [cajaInicialByDate, setCajaInicialByDate] = useState({});
  // categorías
  const [categories, setCategories] = useState({});

  const {
    organization,
    profile,
    user,
    activeAppMode,
    activeAppModeHydrated,
    organizationsOwnedByUser,
    isDualHatUser,
  } = useAuth();
  const orgId = useMemo(
    () =>
      resolveTrainingBlocksOrgId({
        organizationsOwnedByUser,
        organization,
        profile,
        activeAppMode,
        activeAppModeHydrated,
        isDualHatUser,
      }),
    [
      organizationsOwnedByUser,
      organization?.id,
      profile?.organization_id,
      activeAppMode,
      activeAppModeHydrated,
      isDualHatUser,
    ],
  );
  const coachUid = user?.id ?? profile?.id ?? null;
  const bloquesRef = useRef([]);
  const mergeBlocksOpts = useMemo(() => {
    const clientish =
      !activeAppModeHydrated || activeAppMode == null || activeAppMode === 'client';
    return { replaceOrgWhenEmpty: !!orgId && clientish };
  }, [orgId, activeAppMode, activeAppModeHydrated]);

  // ======= Helpers de persistencia (antes de efectos que lo referencian) =======
  const persist = useCallback(async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Persist error', key, e?.message);
    }
  }, []);

  // ======= Hydration =======
  useEffect(() => {
    let cancelled = false;
    const hydrateCap = setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 2500);
    (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const storageEntries = await AsyncStorage.multiGet(keys);
        const storageMap = Object.fromEntries(storageEntries);

        const loadPromises = [];

        if (storageMap[STORAGE_KEYS.BLOQUES]) {
          loadPromises.push(
            new Promise((resolve) => {
              setBloques(JSON.parse(storageMap[STORAGE_KEYS.BLOQUES]));
              resolve();
            }),
          );
        }

        if (storageMap[STORAGE_KEYS.USER_NOTES]) {
          loadPromises.push(
            new Promise((resolve) => {
              setUserNotes(JSON.parse(storageMap[STORAGE_KEYS.USER_NOTES]));
              resolve();
            }),
          );
        }

        if (storageMap[STORAGE_KEYS.RMS]) {
          loadPromises.push(
            new Promise((resolve) => {
              setRms(JSON.parse(storageMap[STORAGE_KEYS.RMS]));
              resolve();
            }),
          );
        }

        if (storageMap[STORAGE_KEYS.PAYMENTS]) {
          loadPromises.push(
            new Promise((resolve) => {
              setPayments(JSON.parse(storageMap[STORAGE_KEYS.PAYMENTS]));
              resolve();
            }),
          );
        }

        if (storageMap[STORAGE_KEYS.SUBSCRIPTIONS]) {
          loadPromises.push(
            new Promise((resolve) => {
              setSubscriptions(JSON.parse(storageMap[STORAGE_KEYS.SUBSCRIPTIONS]));
              resolve();
            }),
          );
        }

        if (storageMap[STORAGE_KEYS.LEDGER]) {
          loadPromises.push(
            new Promise((resolve) => {
              setLedger(JSON.parse(storageMap[STORAGE_KEYS.LEDGER]));
              resolve();
            }),
          );
        }

        if (storageMap[STORAGE_KEYS.CAJA_INICIAL]) {
          loadPromises.push(
            new Promise((resolve) => {
              setCajaInicialByDate(JSON.parse(storageMap[STORAGE_KEYS.CAJA_INICIAL]));
              resolve();
            }),
          );
        }

        if (storageMap[STORAGE_KEYS.CATEGORIES]) {
          loadPromises.push(
            new Promise((resolve) => {
              setCategories(JSON.parse(storageMap[STORAGE_KEYS.CATEGORIES]));
              resolve();
            }),
          );
        }

        await Promise.all(loadPromises);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('TrainingDataProvider hydrate error', e?.message);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(hydrateCap);
    };
  }, []);

  // Sync finanzas desde Supabase (ledger + caja inicial) cuando hay sesión
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const uid = session.user.id;

        const { data: rows } = await supabase
          .from('finanzas_ledger')
          .select('id, tipo, metodo, monto, moneda, notas, fuente, link_id, external_id, fecha')
          .eq('owner_id', uid)
          .order('fecha', { ascending: false });

        if (rows?.length) {
          setLedger((prev) => {
            const next = { ...prev };
            rows.forEach((r) => {
              const key = r.external_id || r.id;
              next[key] = {
                id: key,
                tipo: r.tipo,
                metodo: r.metodo || 'efectivo',
                monto: Number(r.monto),
                moneda: r.moneda || 'ARS',
                notas: r.notas || '',
                fuente: r.fuente || null,
                linkId: r.link_id || null,
                fecha: new Date(r.fecha).getTime(),
              };
            });
            return next;
          });
        }

        const { data: cajaRows } = await supabase
          .from('finanzas_caja_inicial')
          .select('date, monto')
          .eq('owner_id', uid);

        if (cajaRows?.length) {
          const byDate = {};
          cajaRows.forEach((r) => { byDate[r.date] = Number(r.monto); });
          setCajaInicialByDate((prev) => ({ ...prev, ...byDate }));
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Finanzas sync from Supabase', e?.message);
      }
    })();
  }, [hydrated]);

  useEffect(() => {
    bloquesRef.current = bloques;
  }, [bloques]);

  // Rutinas del día: pull desde Supabase por sede (merge con caché local)
  useEffect(() => {
    if (!hydrated || !orgId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await fetchTrainingBlocksForOrg(orgId);
        if (cancelled) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('training_daily_blocks pull', error.message || error);
          return;
        }
        setBloques((prev) => {
          const merged = mergeRemoteTrainingBlocks(prev, data, orgId, mergeBlocksOpts);
          persist(STORAGE_KEYS.BLOQUES, merged).catch(() => {});
          return merged;
        });
        setRefreshTrigger((x) => x + 1);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('training_daily_blocks pull', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, orgId, persist, mergeBlocksOpts]);

  // Cobros y suscripciones (staff) desde Supabase por sede
  useEffect(() => {
    if (!hydrated || !orgId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [pr, sr] = await Promise.all([
          fetchBillingPaymentsForOrg(orgId),
          fetchBillingSubscriptionsForOrg(orgId),
        ]);
        if (cancelled) return;
        if (pr.error) console.warn('billing_payments pull', pr.error.message);
        if (sr.error) console.warn('billing_subscriptions pull', sr.error.message);
        setPayments((prev) => {
          const next = { ...prev };
          for (const row of pr.data || []) {
            const loc = paymentRowToLocal(row);
            if (loc) next[loc.id] = loc;
          }
          persist(STORAGE_KEYS.PAYMENTS, next).catch(() => {});
          return next;
        });
        setSubscriptions((prev) => {
          const next = { ...prev };
          for (const row of sr.data || []) {
            const loc = subscriptionRowToLocal(row);
            if (loc) next[loc.id] = loc;
          }
          persist(STORAGE_KEYS.SUBSCRIPTIONS, next).catch(() => {});
          return next;
        });
        setRefreshTrigger((x) => x + 1);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('billing sync', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, orgId, persist]);

  // ======= Bloques =======
  const refreshTrainingBlocksFromServer = useCallback(async () => {
    if (!orgId) return { ok: false, reason: 'no_org' };
    const { data, error } = await fetchTrainingBlocksForOrg(orgId);
    if (error) return { ok: false, error };
    let merged;
    setBloques((prev) => {
      merged = mergeRemoteTrainingBlocks(prev, data, orgId, mergeBlocksOpts);
      return merged;
    });
    if (merged) {
      await persist(STORAGE_KEYS.BLOQUES, merged);
      setRefreshTrigger((x) => x + 1);
    }
    return { ok: true };
  }, [orgId, persist, mergeBlocksOpts]);

  const saveBloques = useCallback(
    async (next) => {
      const prev = bloquesRef.current || [];
      const withOrg =
        orgId && Array.isArray(next)
          ? next.map((b) =>
              b && !b.organization_id ? { ...b, organization_id: orgId } : b,
            )
          : next;
      setBloques(withOrg);
      await persist(STORAGE_KEYS.BLOQUES, withOrg);
      setRefreshTrigger((x) => x + 1);
      const prevIds = new Set(prev.map((b) => b?.id).filter(Boolean));
      const nextIds = new Set((withOrg || []).map((b) => b?.id).filter(Boolean));
      const removed = [...prevIds].filter((id) => !nextIds.has(id));
      await syncTrainingBlocksToSupabase(withOrg, removed, orgId, coachUid);
    },
    [persist, orgId, coachUid],
  );

  // ======= Notas =======
  const toListArray = useCallback((val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split('\n').map((s) => s.trim()).filter(Boolean);
    return [];
  }, []);

  const saveUserNote = useCallback(
    async (key, combinedStringOrArray) => {
      let value;
      if (Array.isArray(combinedStringOrArray)) {
        value = combinedStringOrArray.join('\n');
      } else {
        value = String(combinedStringOrArray || '');
      }
      setUserNotes((prev) => {
        const next = { ...prev, [key]: value };
        persist(STORAGE_KEYS.USER_NOTES, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
    },
    [persist],
  );

  // ======= RMs =======
  const updateRM = useCallback(
    async (exercise, value) => {
      setRms((prev) => {
        const next = { ...prev, [exercise]: Number(value) };
        persist(STORAGE_KEYS.RMS, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
    },
    [persist],
  );

  const getRM = useCallback(
    (exercise) => {
      if (!exercise) return { ...rms };
      return rms?.[exercise];
    },
    [rms],
  );

  // ======= Pagos =======
  const createPayment = useCallback(
    ({ userId, planId, periodo, monto, moneda = 'ARS', metodo, status = 'pendiente' }) => {
      const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        id,
        userId,
        planId,
        periodo,
        monto,
        moneda,
        metodo,
        status,
        createdAt: Date.now(),
        organization_id: orgId || undefined,
      };
      setPayments((prev) => {
        const next = { ...prev, [id]: payload };
        persist(STORAGE_KEYS.PAYMENTS, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
      if (orgId) {
        upsertBillingPaymentRow(payload, orgId).then(({ error }) => {
          if (error) console.warn('billing_payments upsert', error.message);
        });
      }
      return id;
    },
    [persist, orgId],
  );

  // helper interno: asiento en caja (local + Supabase si hay sesión)
  const _addLedger = useCallback(
    (entry) => {
      const id = entry?.id || `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item = {
        id,
        fecha: entry?.fecha || Date.now(),
        tipo: entry?.tipo,
        metodo: entry?.metodo || 'efectivo',
        monto: Number(entry?.monto || 0),
        moneda: entry?.moneda || 'ARS',
        notas: entry?.notas || '',
        fuente: entry?.fuente || null,
        linkId: entry?.linkId || null,
      };
      setLedger((prev) => {
        const next = { ...prev, [id]: item };
        persist(STORAGE_KEYS.LEDGER, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
      supabase.auth.getSession().then(({ data: { session } } = {}) => {
        if (session?.user?.id) {
          supabase
            .from('finanzas_ledger')
            .insert({
              owner_id: session.user.id,
              tipo: item.tipo,
              metodo: item.metodo,
              monto: item.monto,
              moneda: item.moneda,
              notas: item.notas,
              fuente: item.fuente,
              link_id: item.linkId,
              external_id: id,
              fecha: new Date(item.fecha).toISOString(),
              source: 'app',
            })
            .then(({ error }) => {
              if (error) console.warn('Finanzas ledger insert Supabase', error?.message);
            });
        }
      });
      return id;
    },
    [persist],
  );

  // Al marcar pagado => ingresa a caja
  const markAsPaid = useCallback(
    (paymentId, { metodo = 'efectivo' } = {}) => {
      setPayments((prev) => {
        const p = prev?.[paymentId];
        if (!p) return prev;
        const updated = {
          ...p,
          status: 'pagado',
          metodo,
          paidAt: Date.now(),
          organization_id: p.organization_id || orgId,
        };
        const next = { ...prev, [paymentId]: updated };
        persist(STORAGE_KEYS.PAYMENTS, next);

        _addLedger({
          tipo: 'ingreso',
          fuente: 'pago-usuario',
          metodo,
          monto: p.monto,
          moneda: p.moneda || 'ARS',
          notas: `Pago de ${p.userId} · ${p.planId} · ${p.periodo || 'single'}`,
          linkId: paymentId,
        });

        const oid = updated.organization_id || orgId;
        if (oid) {
          upsertBillingPaymentRow(updated, oid).then(({ error }) => {
            if (error) console.warn('billing_payments upsert', error.message);
          });
        }

        return next;
      });
    },
    [persist, _addLedger, orgId],
  );

  // Pago parcial => ingresa a caja el parcial
  const markAsPartial = useCallback(
    (paymentId, amount, { metodo = 'efectivo' } = {}) => {
      const parcial = Number(amount || 0);
      if (!(parcial > 0)) return;
      setPayments((prev) => {
        const p = prev?.[paymentId];
        if (!p) return prev;
        const acumulado = Number(p.pagadoParcial || 0) + parcial;
        const updated = {
          ...p,
          status: 'parcial',
          metodo,
          pagadoParcial: acumulado,
          lastPartialAt: Date.now(),
          organization_id: p.organization_id || orgId,
        };
        const next = { ...prev, [paymentId]: updated };
        persist(STORAGE_KEYS.PAYMENTS, next);

        _addLedger({
          tipo: 'ingreso',
          fuente: 'pago-parcial',
          metodo,
          monto: parcial,
          moneda: p.moneda || 'ARS',
          notas: `Pago parcial de ${p.userId} · ${p.planId} · ${p.periodo || 'single'}`,
          linkId: paymentId,
        });

        const oid = updated.organization_id || orgId;
        if (oid) {
          upsertBillingPaymentRow(updated, oid).then(({ error }) => {
            if (error) console.warn('billing_payments upsert', error.message);
          });
        }

        return next;
      });
    },
    [persist, _addLedger, orgId],
  );

  // Devolución (total o parcial) => egreso en caja
  const refundPayment = useCallback(
    (paymentId, amountOptional) => {
      setPayments((prev) => {
        const p = prev?.[paymentId];
        if (!p) return prev;
        const monto = amountOptional != null ? Number(amountOptional) : Number(p.monto || 0);
        const updated = {
          ...p,
          status: 'devuelto',
          refundAt: Date.now(),
          refundAmount: monto,
          organization_id: p.organization_id || orgId,
        };
        const next = { ...prev, [paymentId]: updated };
        persist(STORAGE_KEYS.PAYMENTS, next);

        _addLedger({
          tipo: 'egreso',
          fuente: 'devolucion',
          metodo: p.metodo || 'efectivo',
          monto,
          moneda: p.moneda || 'ARS',
          notas: `Devolución pago · ${p.userId} · ${p.planId} · ${p.periodo || 'single'}`,
          linkId: paymentId,
        });

        const oid = updated.organization_id || orgId;
        if (oid) {
          upsertBillingPaymentRow(updated, oid).then(({ error }) => {
            if (error) console.warn('billing_payments upsert', error.message);
          });
        }

        return next;
      });
    },
    [persist, _addLedger, orgId],
  );

  // Consulta de pagos
  const getPayments = useCallback(
    ({ status, metodo, planId, userId } = {}) => {
      const all = Object.values(payments || {});
      return all.filter((p) => {
        if (status && p.status !== status) return false;
        if (metodo && p.metodo !== metodo) return false;
        if (planId && p.planId !== planId) return false;
        if (userId && p.userId !== userId) return false;
        return true;
      });
    },
    [payments],
  );

  // ======= Suscripciones =======
  const createSubscription = useCallback(
    ({ userId, planId, tipo = 'mensual', precio, moneda = 'ARS', diaVencimiento = 5 }) => {
      const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const s = {
        id,
        userId,
        planId,
        tipo,
        precio,
        moneda,
        diaVencimiento,
        activo: true,
        createdAt: Date.now(),
        organization_id: orgId || undefined,
      };
      setSubscriptions((prev) => {
        const next = { ...prev, [id]: s };
        persist(STORAGE_KEYS.SUBSCRIPTIONS, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
      if (orgId) {
        upsertBillingSubscriptionRow(s, orgId).then(({ error }) => {
          if (error) console.warn('billing_subscriptions upsert', error.message);
        });
      }
      return id;
    },
    [persist, orgId],
  );

  const cancelSubscription = useCallback(
    (subscriptionId) => {
      setSubscriptions((prev) => {
        const s = prev?.[subscriptionId];
        if (!s) return prev;
        const updated = {
          ...s,
          activo: false,
          cancelledAt: Date.now(),
          organization_id: s.organization_id || orgId,
        };
        const next = { ...prev, [subscriptionId]: updated };
        persist(STORAGE_KEYS.SUBSCRIPTIONS, next);
        const oid = updated.organization_id || orgId;
        if (oid) {
          upsertBillingSubscriptionRow(updated, oid).then(({ error }) => {
            if (error) console.warn('billing_subscriptions upsert', error.message);
          });
        }
        return next;
      });
    },
    [persist, orgId],
  );

  // Genera "facturas" para suscripciones activas
  const generateNextInvoices = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const periodo = `${y}-${m}`;
    const actives = Object.values(subscriptions || {}).filter((s) => s.activo);
    actives.forEach((s) => {
      createPayment({
        userId: s.userId,
        planId: s.planId,
        periodo,
        monto: s.precio,
        moneda: s.moneda || 'ARS',
        metodo: null,
        status: 'pendiente',
      });
    });
  }, [subscriptions, createPayment]);

  // ======= Caja / Libro diario =======
  const addLedgerEntry = useCallback((entry) => _addLedger(entry), [_addLedger]);

  const editLedgerEntry = useCallback(
    (id, patch) => {
      setLedger((prev) => {
        const curr = prev?.[id];
        if (!curr) return prev;
        const updated = { ...curr, ...patch };
        const next = { ...prev, [id]: updated };
        persist(STORAGE_KEYS.LEDGER, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
      supabase.auth.getSession().then(({ data: { session } } = {}) => {
        if (!session?.user?.id) return;
        const dbPatch = {};
        if (patch.notas !== undefined) dbPatch.notas = patch.notas;
        if (patch.monto !== undefined) dbPatch.monto = patch.monto;
        if (patch.metodo !== undefined) dbPatch.metodo = patch.metodo;
        if (Object.keys(dbPatch).length === 0) return;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const q = supabase.from('finanzas_ledger').update(dbPatch).eq('owner_id', session.user.id);
        (isUuid ? q.eq('id', id) : q.eq('external_id', id)).then(({ error }) => {
          if (error) console.warn('Finanzas ledger update Supabase', error?.message);
        });
      });
    },
    [persist],
  );

  const deleteLedgerEntry = useCallback(
    (id) => {
      setLedger((prev) => {
        if (!prev?.[id]) return prev;
        const next = { ...prev };
        delete next[id];
        persist(STORAGE_KEYS.LEDGER, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
      supabase.auth.getSession().then(({ data: { session } } = {}) => {
        if (!session?.user?.id) return;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const q = supabase.from('finanzas_ledger').delete().eq('owner_id', session.user.id);
        (isUuid ? q.eq('id', id) : q.eq('external_id', id)).then(({ error }) => {
          if (error) console.warn('Finanzas ledger delete Supabase', error?.message);
        });
      });
    },
    [persist],
  );

  const getLedger = useCallback(
    () => Object.values(ledger || {}).sort((a, b) => (b.fecha || 0) - (a.fecha || 0)),
    [ledger],
  );

  const getLedgerSummary = useCallback(
    ({ from, to } = {}) => {
      const list = getLedger();
      let ingresos = 0;
      let egresos = 0;
      for (const m of list) {
        if (from && m.fecha < from) continue;
        if (to && m.fecha > to) continue;
        if (m.tipo === 'ingreso') ingresos += Number(m.monto || 0);
        else if (m.tipo === 'egreso') egresos += Number(m.monto || 0);
      }
      return { ingresos, egresos, balance: ingresos - egresos };
    },
    [getLedger],
  );

  // ======= Caja inicial del día =======
  const getOpenBalance = useCallback(
    (dateStr) => {
      const n = Number(cajaInicialByDate?.[dateStr]);
      return Number.isNaN(n) ? 0 : n;
    },
    [cajaInicialByDate],
  );

  const setOpenBalance = useCallback(
    (dateStr, monto) => {
      const num = Number(monto);
      if (Number.isNaN(num) || num < 0) return;
      setCajaInicialByDate((prev) => {
        const next = { ...prev, [dateStr]: num };
        persist(STORAGE_KEYS.CAJA_INICIAL, next);
        return next;
      });
      setRefreshTrigger((x) => x + 1);
      supabase.auth.getSession().then(({ data: { session } } = {}) => {
        if (session?.user?.id) {
          supabase
            .from('finanzas_caja_inicial')
            .upsert(
              { owner_id: session.user.id, date: dateStr, monto: num },
              { onConflict: 'owner_id,date' }
            )
            .then(({ error }) => {
              if (error) console.warn('Finanzas caja_inicial upsert Supabase', error?.message);
            });
        }
      });
    },
    [persist],
  );

  // ======= Categorías =======
  const upsertCategory = useCallback(
    (cat) => {
      const id = cat?.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const item = { id, nombre: cat?.nombre || 'Sin nombre', tipo: cat?.tipo || 'generico' };
      setCategories((prev) => {
        const next = { ...prev, [id]: item };
        persist(STORAGE_KEYS.CATEGORIES, next);
        return next;
      });
    },
    [persist],
  );

  const deleteCategory = useCallback(
    (id) => {
      setCategories((prev) => {
        if (!prev?.[id]) return prev;
        const next = { ...prev };
        delete next[id];
        persist(STORAGE_KEYS.CATEGORIES, next);
        return next;
      });
    },
    [persist],
  );

  // ======= util pública =======
  const calculateWeight = useCallback((percentage, rm, reps = 1) => {
    return calculateWeightFromRm(percentage, rm, reps);
  }, []);

  // ======= value memoizado =======
  const value = useMemo(
    () => ({
      hydrated,
      refreshTrigger,

      bloques,
      saveBloques,
      refreshTrainingBlocksFromServer,

      userNotes,
      saveUserNote,

      getRM,
      updateRM,
      calculateWeight,

      payments,
      createPayment,
      markAsPaid,
      markAsPartial,
      refundPayment,
      getPayments,

      subscriptions,
      createSubscription,
      cancelSubscription,
      generateNextInvoices,

      ledger,
      addLedgerEntry,
      editLedgerEntry,
      deleteLedgerEntry,
      getLedger,
      getLedgerSummary,
      getOpenBalance,
      setOpenBalance,
      categories,
      upsertCategory,
      deleteCategory,
    }),
    [
      hydrated,
      refreshTrigger,
      bloques,
      saveBloques,
      refreshTrainingBlocksFromServer,
      userNotes,
      saveUserNote,
      getRM,
      updateRM,
      calculateWeight,
      payments,
      createPayment,
      markAsPaid,
      markAsPartial,
      refundPayment,
      getPayments,
      subscriptions,
      createSubscription,
      cancelSubscription,
      generateNextInvoices,
      ledger,
      addLedgerEntry,
      editLedgerEntry,
      deleteLedgerEntry,
      getLedger,
      getLedgerSummary,
      getOpenBalance,
      setOpenBalance,
      categories,
      upsertCategory,
      deleteCategory,
    ],
  );

  return (
    <TrainingDataContext.Provider value={value}>
      {hydrated ? children : null}
    </TrainingDataContext.Provider>
  );
}

export function useTrainingData() {
  const ctx = useContext(TrainingDataContext);
  if (!ctx) throw new Error('useTrainingData must be used within TrainingDataProvider');
  return ctx;
}
