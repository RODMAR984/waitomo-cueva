// screens/AbonosPasesScreen.js - Abonos y Pases con multi-plan + pase libre
// ✅ Lee abonos reales desde Supabase (public.abonos)
// - price_cents NULL => "Precio a definir"
// - Incluye también plan_id = 'all_access' (pase libre total)
import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import ScreenShell from '../../components/ScreenShell';
import { usePlanContext } from '../../contexts/PlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { colors } from '../../theme/colors';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import BackNavButton from '../../components/BackNavButton';
import NeoPanel from '../../components/NeoPanel';
import { WEB_CONTENT_MAX_WIDTH, WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

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
  const { user, session, loading, profile, organization } = useAuth();
  const organizationId = organization?.id || profile?.organization_id || null;

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;

  const soloEvolucion = route?.params?.soloEvolucion === true;

  const plan = soloEvolucion
    ? { id: 'evolucion', name: 'evolucion', title: 'Ciclo Evolución', nombre: 'Ciclo Evolución' }
    : (route?.params?.plan ?? ctx?.plan ?? null);

  if (!plan) {
    const testPlan = { id: 'cross', name: 'cross', title: 'CROSS TRAINING' };
    return (
      <ScreenShell plan={testPlan}>
        <Text style={{ color: 'white', padding: 20 }}>
          No se recibió un plan. Volvé atrás y elegí uno.
        </Text>
        <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={{ marginTop: 16 }} />
      </ScreenShell>
    );
  }

  const planKeyRaw = plan?.id ?? plan?.name ?? plan?.nombre ?? plan?.plan_id ?? '';
  const planKeyInput = String(planKeyRaw).toLowerCase().trim();
  const planKey = normalizePlanKey(planKeyInput) || planKeyInput;
  const rowPlanCanon = (value) => {
    const raw = String(value || '').toLowerCase().trim();
    const norm = normalizePlanKey(raw) || raw;
    if (norm === 'pase_total') return 'all_access';
    return norm;
  };
  const isEvolucion = soloEvolucion || planKey === 'evolucion' ||
    /evoluci[oó]n/i.test(String(plan?.title ?? plan?.nombre ?? ''));
  const isPaseTotal = planKey === 'pase_total';
  const showAddonPlani = planKey === 'openbox' || planKey === 'pase_total';

  const [abonos, setAbonos] = useState([]);
  const [abonosLoading, setAbonosLoading] = useState(false);
  const [abonosError, setAbonosError] = useState(null);
  const cardPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (soloEvolucion) setAbonos([]);
  }, [soloEvolucion]);

  useEffect(() => {
    if (abonosLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardPulse, { toValue: 1.014, duration: 1200, useNativeDriver: true }),
        Animated.timing(cardPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [abonosLoading, cardPulse]);

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
    const rowPlan = rowPlanCanon(row?.plan_id);
    const isEvolRow = rowPlan === 'evolucion';
    const buildBullets = () => {
      if (isEvolRow) {
        if (duration) {
          return [
            `Rutina personalizada con vigencia de ${duration} días`,
            'Progresión pensada para tu nivel',
            'Gestión simple desde tu panel',
          ];
        }
        return [
          'Rutina personalizada para tu nivel',
          'Seguimiento semanal desde el gym',
          'Gestión simple desde tu panel',
        ];
      }
      if (isUnlimited) {
        return [
          duration
            ? `Acceso ilimitado a las clases del plan durante ${duration} días`
            : 'Acceso ilimitado a las clases del plan',
          'Reservá cuando quieras dentro de la vigencia',
          'Gestión simple desde tu panel',
        ];
      }
      const sessions = row?.included_sessions;
      const line1 =
        duration != null && sessions != null
          ? `${sessions} clases para usar en ${duration} días`
          : sessions != null
            ? `${sessions} clases incluidas en tu abono`
            : 'Clases incluidas según tu abono';
      return [line1, 'Reservá tus cupos con anticipación', 'Gestión simple desde tu panel'];
    };
    const customBullets = (() => {
      const s = String(row?.card_highlights ?? '').trim();
      if (!s) return null;
      const lines = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      return lines.length ? lines.slice(0, 10) : null;
    })();
    const bullets = customBullets ?? buildBullets();

    const isFeatured =
      !isEvolRow &&
      ((rowPlan === planKey && isUnlimited && duration === 30) ||
       (rowPlan === 'all_access' && isUnlimited && duration === 30));

    return {
      // compat: pantallas siguientes ya esperan un "abono" que viaja por params
      id: row?.id,
      plan_id: rowPlan,
      title: row?.name,
      bullets,
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
        const planIds = isPaseTotal
          ? ['all_access']
          : isEvolucion
            ? ['evolucion']
            : Array.from(new Set([planKey, planKeyInput].filter(Boolean)));
        let q = supabase
          .from('abonos')
          .select(
            'id, plan_id, name, duration_days, included_sessions, price_cents, currency, is_active, organization_id, card_highlights'
          )
          .eq('is_active', true);
        // Regla robusta: primero scope por org; luego filtramos por clave canónica en app.
        // Evita romper cuando cada org usa IDs tipo Yoga_pase_mensual, cross_pase_full, etc.
        if (organizationId) q = q.eq('organization_id', organizationId);
        else q = q.in('plan_id', planIds);
        const { data, error } = await q;

        if (error) throw error;
        let rows = Array.isArray(data) ? data : [];

        // ❌ No queremos mostrar el Pase Libre de 90 días (doc: eliminarlo de la app)
        rows = rows.filter((r) => Number(r?.duration_days || 0) !== 90);
        if (isEvolucion) {
          rows = rows.filter((r) => rowPlanCanon(r?.plan_id) === 'evolucion');
        } else if (isPaseTotal) {
          rows = rows.filter((r) => rowPlanCanon(r?.plan_id) === 'all_access');
        } else {
          rows = rows.filter((r) => {
            const rp = rowPlanCanon(r?.plan_id);
            return rp === planKey || rp === 'all_access';
          });
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
  const cardEdgeCyan = useMemo(
    () => hexToRgbaLocal(t.logoCian || t.brand, 0.92),
    [t.logoCian, t.brand],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrollView: {
          flex: 1,
        },
        container: {
          flexGrow: 1,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingTop: MOBILE_SPACING.lg,
          paddingBottom: 24 + bottomSafe,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        header: {
          marginBottom: 14,
          alignItems: 'center', // ✅ centra todo el bloque header
        },
        headerBackWrap: {
          width: '100%',
          alignItems: 'flex-start',
          marginBottom: 10,
        },
        title: {
          color: t.brand,
          fontSize: MOBILE_TYPE.title,
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
          fontSize: MOBILE_TYPE.caption,
          textAlign: 'center',
          width: '100%',
        },
        introPanel: {
          width: '100%',
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          backgroundColor: t.boxBg,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.md + 2,
          marginTop: MOBILE_SPACING.sm + 2,
        },
        introLine: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
        },
        sectionTitle: {
          color: t.brand,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '800',
          marginTop: 16,
          marginBottom: 8,
          marginLeft: 4,
        },
        cardsGrid: {
          flexDirection: isWebDesktop ? 'row' : 'column',
          flexWrap: isWebDesktop ? 'wrap' : 'nowrap',
          columnGap: isWebDesktop ? 12 : 0,
        },
        cardCol: {
          width: isWebDesktop ? '48.8%' : '100%',
        },
        card: {
          padding: isWebDesktop ? 20 : 16,
          marginBottom: 12,
          minHeight: isWebDesktop ? 270 : 0,
          borderRadius: MOBILE_RADII.lg,
          backgroundColor: t.boxBg,
        },
        cardTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          letterSpacing: 0.5,
        },
        cardBenefit: {
          marginTop: 8,
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
        },
        trialStrip: {
          marginTop: 12,
          marginBottom: 4,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1.5,
          borderColor: cardEdgeCyan,
          backgroundColor: hexToRgbaLocal(t.logoCian || t.brand, 0.1),
        },
        trialStripTitle: {
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
        },
        trialStripHint: {
          marginTop: 6,
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 18,
        },
        trialStripCta: {
          marginTop: 10,
          color: t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '800',
        },
        featuredPill: {
          marginTop: 10,
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: hexToRgbaLocal(t.brand, 0.5),
          backgroundColor: hexToRgbaLocal(t.brand, 0.14),
          borderRadius: MOBILE_RADII.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        featuredPillText: {
          color: t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '800',
          letterSpacing: 0.5,
        },
        price: {
          marginTop: 10,
          color: t.brand,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
        },
        button: {
          marginTop: 12,
          minHeight: MOBILE_SIZES.controlHeight,
          paddingVertical: 10,
          paddingHorizontal: MOBILE_SPACING.lg,
          borderRadius: MOBILE_RADII.md,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: isWebDesktop ? 'flex-start' : 'stretch',
          width: isWebDesktop ? 170 : '100%',
          ...t.buttonPrimary,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontWeight: '800',
          fontSize: MOBILE_TYPE.bodyStrong,
          letterSpacing: 0.6,
        },
        buttonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        backBtn: {
          marginTop: 8,
        },
        backText: {
          color: t.subText,
          fontWeight: '700',
        },
        stateBlock: { paddingVertical: MOBILE_SPACING.xl, alignItems: 'center' },
        stateText: { color: t.subText, fontSize: MOBILE_TYPE.caption, textAlign: 'center' },
        stateTextSmall: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          marginTop: 6,
          textAlign: 'center',
        },
        stateTextSpaced: { marginTop: 10 },
      }),
    [t, bottomSafe, isWebDesktop, cardEdgeCyan],
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
          skipProfileCompletion: true,
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
    bullets: [
      'Planificación mensual personalizada para Open Box',
      'Ajustes según tu disponibilidad y objetivos',
      'Coordinación con recepción del gym',
    ],
    price: 'Consultar',
    precio: null,
    plan_id: 'openbox',
    featured: false,
  } : null;

  const renderAbonoCard = (a) => (
    <View key={a.id} style={styles.cardCol}>
      <Animated.View style={{ transform: [{ scale: cardPulse }] }}>
        <NeoPanel spark style={styles.card}>
          <Text style={styles.cardTitle}>{a.title}</Text>
          <Text style={styles.price}>{a.price}</Text>
          {a.featured ? (
            <View style={styles.featuredPill}>
              <Text style={styles.featuredPillText}>RECOMENDADO</Text>
            </View>
          ) : null}
          {(Array.isArray(a.bullets) ? a.bullets : []).map((line, i) => (
            <Text key={i} style={styles.cardBenefit}>
              ✓ {line}
            </Text>
          ))}
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleContratar(a)}
            activeOpacity={0.85}
          >
            <View style={styles.buttonRow}>
              <Text style={styles.buttonText}>{tStr('abonos_contratar')}</Text>
              <Ionicons name="arrow-forward" size={16} color={t.buttonPrimaryText?.color || '#fff'} />
            </View>
          </TouchableOpacity>
        </NeoPanel>
      </Animated.View>
    </View>
  );

  const renderSectionTitle = (text) => (
    <Text style={styles.sectionTitle}>{text}</Text>
  );

  return (
    <ScreenShell plan={plan}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.header}>
          <View style={styles.headerBackWrap}>
            <BackNavButton onPress={() => navigation.goBack()} label={tStr('abonos_volver')} style={styles.backBtn} />
          </View>
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
          <View style={styles.introPanel}>
            <Text style={styles.introLine}>Elegí el formato que mejor se adapta a tu semana y empezá hoy.</Text>
          </View>
          {!isEvolucion && !isPaseTotal ? (
            <TouchableOpacity
              style={styles.trialStrip}
              onPress={() => navigation.navigate('FreeClassRequest', { plan })}
              activeOpacity={0.88}
            >
              <Text style={styles.trialStripTitle}>{tStr('abonos_free_class_title')}</Text>
              <Text style={styles.trialStripHint}>{tStr('abonos_free_class_hint')}</Text>
              <Text style={styles.trialStripCta}>{tStr('abonos_free_class_cta')} ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {abonosLoading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator size="small" color={t.brand} />
            <Text style={[styles.stateText, styles.stateTextSpaced]}>
              {tStr('abonos_loading')}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && abonosError ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateText}>
              {tStr('abonos_error')}
            </Text>
            <Text style={styles.stateTextSmall}>
              {String(abonosError)}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && !abonosError && isEvolucion && evolucionAbonos.length === 0 ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateText}>
              {tStr('abonos_empty_evolucion')}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && !abonosError && !isEvolucion && abonos.length === 0 && !showAddonPlani ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateText}>
              {isPaseTotal ? tStr('abonos_empty_total') : tStr('abonos_empty_plan')}
            </Text>
          </View>
        ) : null}

        {!abonosLoading && !abonosError && isEvolucion && (
          <View style={styles.cardsGrid}>{evolucionAbonos.map(renderAbonoCard)}</View>
        )}

        {!abonosLoading && !abonosError && !isEvolucion && (
          <>
            {isPaseTotal && paseLibreAbonos.length > 0 && (
              <>
                {renderSectionTitle(tStr('abonos_section_total'))}
                <View style={styles.cardsGrid}>{paseLibreAbonos.map(renderAbonoCard)}</View>
              </>
            )}
            {!isPaseTotal && planAbonos.length > 0 && (
              <>
                {renderSectionTitle(`Abonos de ${plan?.title || plan?.nombre || plan?.id}`)}
                <View style={styles.cardsGrid}>{planAbonos.map(renderAbonoCard)}</View>
              </>
            )}
            {!isPaseTotal && paseLibreAbonos.length > 0 && (
              <>
                {renderSectionTitle(tStr('abonos_section_libre'))}
                <View style={styles.cardsGrid}>{paseLibreAbonos.map(renderAbonoCard)}</View>
              </>
            )}
            {showAddonPlani && addonPlaniAbono && (
              <>
                {renderSectionTitle(tStr('abonos_section_planificacion'))}
                <View style={styles.cardsGrid}>
                  <View style={styles.cardCol}>
                    <NeoPanel spark style={styles.card}>
                      <Text style={styles.cardTitle}>{addonPlaniAbono.title}</Text>
                      <Text style={styles.price}>{addonPlaniAbono.price}</Text>
                      {(addonPlaniAbono.bullets || []).map((line, i) => (
                        <Text key={i} style={styles.cardBenefit}>
                          ✓ {line}
                        </Text>
                      ))}
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => handleContratar(addonPlaniAbono)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.buttonText}>{tStr('abonos_contratar')}</Text>
                      </TouchableOpacity>
                    </NeoPanel>
                  </View>
                </View>
              </>
            )}
          </>
        )}

      </ScrollView>
    </ScreenShell>
  );
}

AbonosPasesScreen.propTypes = {
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object,
};
