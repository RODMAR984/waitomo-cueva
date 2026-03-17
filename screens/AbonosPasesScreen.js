// screens/AbonosPasesScreen.js - Abonos y Pases con multi-plan + pase libre
// ✅ Lee abonos reales desde Supabase (public.abonos)
// - price_cents NULL => "Precio a definir"
// - Incluye también plan_id = 'all_access' (pase libre total)
import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { usePlanContext } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

const hexToRgbaLocal = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full =
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function AbonosPasesScreen({ navigation, route }) {
  const ctx = usePlanContext();
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom || 0, Platform.OS === 'android' ? 24 : 0);

  // ✅ PARCHE: traemos session/loading/profile para decidir flujo correcto
  const { user, session, loading, profile } = useAuth();
  const organizationId = profile?.organization_id || null;

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const soloEvolucion = route?.params?.soloEvolucion === true;

  const plan = soloEvolucion
    ? { id: 'evolucion', name: 'evolucion', title: 'Ciclo Evolución', nombre: 'Ciclo Evolución' }
    : (route?.params?.plan ?? ctx?.plan ?? null);

  if (!plan) {
    const testPlan = { id: 'cross', name: 'cross', title: 'CROSS TRAINING' };
    return (
      <BackgroundWrapper plan={testPlan}>
        <Text style={{ color: 'white', padding: 20 }}>
          No se recibió un plan. Volvé atrás y elegí uno.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: '#0dd' }}>Volver</Text>
        </TouchableOpacity>
      </BackgroundWrapper>
    );
  }

  const planKeyRaw = plan?.id ?? plan?.name ?? plan?.nombre ?? plan?.plan_id ?? '';
  const planKey = String(planKeyRaw).toLowerCase().trim();
  const isEvolucion = soloEvolucion || planKey === 'evolucion' ||
    /evoluci[oó]n/i.test(String(plan?.title ?? plan?.nombre ?? ''));
  const isPaseTotal = planKey === 'pase_total';
  const showAddonPlani = planKey === 'openbox' || planKey === 'pase_total';

  const [abonos, setAbonos] = useState([]);
  const [abonosLoading, setAbonosLoading] = useState(false);
  const [abonosError, setAbonosError] = useState(null);

  useEffect(() => {
    if (soloEvolucion) setAbonos([]);
  }, [soloEvolucion]);

  const formatMoney = (priceCents, currency = 'ARS') => {
    if (priceCents == null) return null;
    const amount = Number(priceCents) / 100;
    try {
      // Intl suele funcionar en Expo. Si no, caemos a formato simple.
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch (_) {
      const pesos = Math.round(amount);
      const n = String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `$ ${n}`;
    }
  };

  const toUI = (row) => {
    const isUnlimited = row?.included_sessions == null;
    const duration = row?.duration_days ?? null;
    const currency = row?.currency || 'ARS';
    const money = formatMoney(row?.price_cents, currency);

    // Ciclo Evolución: no usar "Acceso ilimitado"; son rutinas personalizadas por frecuencia
    const isEvolRow = row?.plan_id === 'evolucion';
    const subtitle = isEvolRow
      ? (duration ? `Rutina personalizada • ${duration} días` : 'Rutina personalizada')
      : isUnlimited
        ? `Acceso ilimitado • ${duration} días`
        : `${row?.included_sessions} clases • ${duration} días`;

    const isFeatured =
      !isEvolRow &&
      ((row?.plan_id === planKey && isUnlimited && duration === 30) ||
       (row?.plan_id === 'all_access' && isUnlimited && duration === 30));

    return {
      // compat: pantallas siguientes ya esperan un "abono" que viaja por params
      id: row?.id,
      plan_id: row?.plan_id,
      title: row?.name,
      subtitle,
      price: money || 'Precio a definir',
      // compat con Pago/RegistroInicial
      precio: money || null,
      price_cents: row?.price_cents ?? null,
      currency,
      duration_days: duration,
      included_sessions: row?.included_sessions ?? null,
      featured: !!isFeatured,
      __row: row,
    };
  };

  const evolucionOrder = (name) => {
    const n = String(name || '').toLowerCase();
    if (n.includes('rookie')) return 0;
    if (n.includes('scaled')) return 1;
    if (n.includes('atleta')) return 2;
    return 3;
  };

  const sortAbonos = (a, b) => {
    // Ciclo Evolución: solo Rookie, Scaled, Atleta en ese orden
    if (isEvolucion) {
      return evolucionOrder(a.title) - evolucionOrder(b.title);
    }

    // 1) primero el plan seleccionado, después all_access
    const aGroup = a.plan_id === planKey ? 0 : a.plan_id === 'all_access' ? 1 : 2;
    const bGroup = b.plan_id === planKey ? 0 : b.plan_id === 'all_access' ? 1 : 2;
    if (aGroup !== bGroup) return aGroup - bGroup;

    // 2) dentro del grupo: ilimitado primero, luego packs
    const aUnlimited = a.included_sessions == null ? 0 : 1;
    const bUnlimited = b.included_sessions == null ? 0 : 1;
    if (aUnlimited !== bUnlimited) return aUnlimited - bUnlimited;

    // 3) duración asc
    const ad = a.duration_days ?? 9999;
    const bd = b.duration_days ?? 9999;
    if (ad !== bd) return ad - bd;

    // 4) si es pack: más clases primero
    const ai = a.included_sessions ?? -1;
    const bi = b.included_sessions ?? -1;
    if (ai !== bi) return bi - ai;

    return String(a.title || '').localeCompare(String(b.title || ''));
  };

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!planKey) {
        setAbonos([]);
        return;
      }

      setAbonosLoading(true);
      setAbonosError(null);

      try {
        // getAbonos(planId) según doc:
        // - pase_total  → SOLO abonos de Pase Total (plan_id all_access en BD)
        // - evolucion   → si llegara acá, solo abonos de evolucion (Rookie/Scaled/Atleta)
        // - universo 1 → solo abonos de ESA actividad (4/8/12/Pase Libre), sin mezclar otras
        const planIds = isPaseTotal ? ['all_access'] : isEvolucion ? ['evolucion'] : [planKey];
        let q = supabase
          .from('abonos')
          .select(
            'id, plan_id, name, duration_days, included_sessions, price_cents, currency, is_active, organization_id'
          )
          .eq('is_active', true)
          .in('plan_id', planIds);
        if (organizationId) {
          q = q.eq('organization_id', organizationId);
        }
        const { data, error } = await q;

        if (error) throw error;
        let rows = Array.isArray(data) ? data : [];

        // ❌ No queremos mostrar el Pase Libre de 90 días (doc: eliminarlo de la app)
        rows = rows.filter((r) => Number(r?.duration_days || 0) !== 90);
        if (isEvolucion) {
          rows = rows.filter((r) => String(r?.plan_id || '').toLowerCase() === 'evolucion');
        }
        if (isPaseTotal) {
          rows = rows.filter((r) => String(r?.plan_id || '').toLowerCase() === 'all_access');
        }

        let ui = rows.map(toUI).sort(sortAbonos);
        if (isEvolucion) ui = ui.filter((a) => a.plan_id === 'evolucion');
        if (isPaseTotal) {
          ui = ui.filter((a) => a.plan_id === 'all_access');
          if (ui.length > 1) ui = [ui[0]]; // Pase Total debe tener una sola opción visible
        }

        if (alive) setAbonos(ui);
      } catch (e) {
        console.log('❌ AbonosPases: error cargando abonos:', e?.message || e);
        if (alive) setAbonosError(e?.message || 'Error cargando abonos');
      } finally {
        if (alive) setAbonosLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [planKey, isEvolucion, isPaseTotal, organizationId]);

  // -------------------------
  // UI helpers
  // -------------------------
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrollView: {
          flex: 1,
        },
        container: {
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24 + bottomSafe,
        },
        header: {
          marginBottom: 14,
          alignItems: 'center', // ✅ centra todo el bloque header
        },
        title: {
          color: t.brand,
          fontSize: 20,
          fontWeight: '800',
          letterSpacing: 1,
          textShadowColor: hexToRgbaLocal(t.brand, 0.25),
          textShadowRadius: 10,
          textAlign: 'center', // ✅
          width: '100%', // ✅ asegura centrado real
        },
        subtitle: {
          marginTop: 6,
          color: t.subText,
          fontSize: 12,
          textAlign: 'center',
          width: '100%',
        },
        sectionTitle: {
          color: t.brand,
          fontSize: 14,
          fontWeight: '800',
          marginTop: 16,
          marginBottom: 8,
          marginLeft: 4,
        },
        card: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          borderRadius: 18,
          padding: 14,
          marginBottom: 12,
        },
        featuredCard: {
          borderColor: t.overlayBorder,
          shadowColor: t.brand,
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
        cardTitle: {
          color: t.text,
          fontSize: 16,
          fontWeight: '800',
          letterSpacing: 0.5,
        },
        cardSubtitle: {
          marginTop: 4,
          color: t.subText,
          fontSize: 12,
        },
        price: {
          marginTop: 10,
          color: t.brand,
          fontSize: 16,
          fontWeight: '800',
        },
        button: {
          marginTop: 12,
          paddingVertical: 10,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontWeight: '800',
          letterSpacing: 0.6,
        },
        backBtn: {
          marginTop: 6,
          paddingVertical: 10,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: hexToRgbaLocal(t.brand, 0.2),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hexToRgbaLocal('#000000', 0.25),
        },
        backText: {
          color: t.subText,
          fontWeight: '700',
        },
      }),
    [t, bottomSafe],
  );

  // -------------------------
  // CTA contratar
  // -------------------------
  const handleContratar = async (abonoSeleccionado) => {
    try {
      // 1) Sin usuario → Crear cuenta (elige email o Google, luego RegistroInicial)
      if (!user?.id) {
        navigation.navigate('CreateAccount', {
          plan,
          abono: abonoSeleccionado,
        });
        return;
      }

      // 2) Usuario con perfil completo → ir directo a Pago (contratar otro plan / renovar)
      if (profile?.id) {
        const userData = {
          id: user.id,
          nombre: profile?.full_name || user?.user_metadata?.full_name || '',
          telefono: profile?.phone || user?.user_metadata?.phone || '',
          email: user?.email || '',
          ...(abonoSeleccionado?.precio != null ? { precio: abonoSeleccionado.precio } : {}),
        };
        navigation.navigate('Pago', {
          plan,
          userData,
          abono: abonoSeleccionado,
        });
        return;
      }

      // 3) Usuario sin perfil (nuevo con Google/email) → completar datos y luego pago
      const provider = user?.app_metadata?.provider || null;
      const isOAuth = !!provider && provider !== 'email';

      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'RegistroInicial',
            params: {
              plan,
              abono: abonoSeleccionado,
              fromOAuth: isOAuth,
            },
          },
        ],
      });
    } catch (err) {
      console.log('❌ Error handleContratar:', err);
    }
  };

  const planAbonos = !isEvolucion ? abonos.filter((a) => a.plan_id === planKey) : [];
  const paseLibreAbonos = !isEvolucion ? abonos.filter((a) => a.plan_id === 'all_access') : [];
  const evolucionAbonos = isEvolucion ? abonos.filter((a) => a.plan_id === 'evolucion') : [];

  const addonPlaniAbono = showAddonPlani ? {
    id: 'addon-plani-openbox',
    title: 'Add-on Plani Open Box',
    subtitle: 'Planificación mensual personalizada para Open Box',
    price: 'Consultar',
    precio: null,
    plan_id: 'openbox',
    featured: false,
  } : null;

  const renderAbonoCard = (a) => (
    <View
      key={a.id}
      style={[styles.card, a.featured ? styles.featuredCard : null]}
    >
      <Text style={styles.cardTitle}>{a.title}</Text>
      <Text style={styles.cardSubtitle}>{a.subtitle}</Text>
      <Text style={styles.price}>{a.price}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handleContratar(a)}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>{tStr('abonos_contratar')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSectionTitle = (text) => (
    <Text style={styles.sectionTitle}>{text}</Text>
  );

  return (
    <BackgroundWrapper plan={plan}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {isPaseTotal ? tStr('abonos_title_total') : isEvolucion ? tStr('abonos_title_evolucion') : `ABONOS - ${plan?.title || plan?.nombre || plan?.id}`}
          </Text>
          <Text style={styles.subtitle}>
            {isPaseTotal
              ? tStr('abonos_subtitle_total')
              : isEvolucion
              ? tStr('abonos_subtitle_evolucion')
              : `Elegí tu abono o pase para ${plan?.title || plan?.nombre || plan?.id}`}
          </Text>
        </View>

        {abonosLoading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={t.brand} />
            <Text style={{ color: t.subText, marginTop: 10, fontSize: 12 }}>
              {tStr('abonos_loading')}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && abonosError ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: t.subText, fontSize: 12, textAlign: 'center' }}>
              {tStr('abonos_error')}
            </Text>
            <Text style={{ color: t.subText, fontSize: 11, marginTop: 6, textAlign: 'center' }}>
              {String(abonosError)}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && !abonosError && isEvolucion && evolucionAbonos.length === 0 ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: t.subText, fontSize: 12, textAlign: 'center' }}>
              {tStr('abonos_empty_evolucion')}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && !abonosError && !isEvolucion && abonos.length === 0 && !showAddonPlani ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: t.subText, fontSize: 12, textAlign: 'center' }}>
              {isPaseTotal ? tStr('abonos_empty_total') : tStr('abonos_empty_plan')}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && !abonosError && isEvolucion && evolucionAbonos.map(renderAbonoCard)}

        {!abonosLoading && !abonosError && !isEvolucion && (
          <>
            {isPaseTotal && paseLibreAbonos.length > 0 && (
              <>
                {renderSectionTitle(tStr('abonos_section_total'))}
                {paseLibreAbonos.map(renderAbonoCard)}
              </>
            )}
            {!isPaseTotal && planAbonos.length > 0 && (
              <>
                {renderSectionTitle(`Abonos de ${plan?.title || plan?.nombre || plan?.id}`)}
                {planAbonos.map(renderAbonoCard)}
              </>
            )}
            {!isPaseTotal && paseLibreAbonos.length > 0 && (
              <>
                {renderSectionTitle(tStr('abonos_section_libre'))}
                {paseLibreAbonos.map(renderAbonoCard)}
              </>
            )}
            {showAddonPlani && addonPlaniAbono && (
              <>
                {renderSectionTitle(tStr('abonos_section_planificacion'))}
                <View style={[styles.card]}>
                  <Text style={styles.cardTitle}>{addonPlaniAbono.title}</Text>
                  <Text style={styles.cardSubtitle}>{addonPlaniAbono.subtitle}</Text>
                  <Text style={styles.price}>{addonPlaniAbono.price}</Text>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => handleContratar(addonPlaniAbono)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.buttonText}>{tStr('abonos_contratar')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.backText}>{tStr('abonos_volver')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </BackgroundWrapper>
  );
}

AbonosPasesScreen.propTypes = {
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object,
};
