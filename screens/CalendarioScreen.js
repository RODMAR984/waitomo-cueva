// screens/CalendarioScreen.js — Waitomo Dark Only (brillo unificado en paneles / inputs)
// Funcionalidad preservada: días, horarios, recordatorio apto médico, navegación a TrabajoDelDia

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { usePlanContext } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

// ---------- helpers ----------
const { height } = Dimensions.get('window');

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const getNextDays = (start = 0, count = 30, locale = 'es') => {
  const dateLocale = locale === 'en' ? 'en-US' : 'es-AR';
  const days = [];
  const today = new Date();
  for (let i = start; i < start + count; i += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    days.push({
      label: day.toLocaleDateString(dateLocale, { weekday: 'short' }),
      number: day.getDate(),
      full: day.toISOString().split('T')[0],
    });
  }
  return days;
};

const generarHorarios = (planName) => {
  const desde = 7;
  const hasta = 21;
  const salto = planName === 'Open Box' ? 2 : 1;
  const horarios = [];
  for (let h = desde; h <= hasta; h += salto) {
    horarios.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return horarios;
};

// Plan para fondo y horarios: params (si viniste por navegación) > PlanContext > perfil del usuario
const PLAN_LABELS = {
  cross: 'Cross Training',
  hyrox: 'Hyrox',
  evolucion: 'Evolución',
  stretching: 'Stretching',
  yoga: 'Yoga',
  openbox: 'Open Box',
  oly: 'Oly',
  all_access: 'Pase libre',
};

function planFromProfile(planActual) {
  const raw = String(planActual || '').toLowerCase().trim();
  if (!raw) return null;
  const id = raw.includes('cross') ? 'cross' : raw.includes('open') ? 'openbox' : raw.includes('evol') ? 'evolucion' : raw.includes('stretch') ? 'stretching' : raw.includes('yoga') ? 'yoga' : raw.includes('oly') ? 'oly' : raw.includes('hyrox') ? 'hyrox' : raw;
  const nombre = PLAN_LABELS[id] || raw;
  return { id, nombre, name: nombre, title: nombre };
}

// ---------- screen ----------
export default function CalendarioScreen({ route, navigation }) {
  const { plan: contextPlan } = usePlanContext();
  const { profile } = useAuth();
  const params = route?.params || {};
  const planParam = params?.plan || null;
  const plan = planParam || contextPlan || planFromProfile(profile?.plan_actual);
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();

  const [diaSeleccionado, setDiaSeleccionado] = useState(getNextDays(0, 1, locale)[0].full);
  const dateLocale = locale === 'en' ? 'en-US' : 'es-AR';
  const days = useMemo(() => getNextDays(0, 30, locale), [locale]);
  const horarios = generarHorarios(plan?.nombre || 'Cross Training');

  const handleReserva = (hora) => {
    navigation.navigate('TrabajoDelDia', { fecha: diaSeleccionado, hora, plan });
  };

  const mes = useMemo(
    () =>
      new Date(diaSeleccionado).toLocaleDateString(dateLocale, {
        month: 'long',
        year: 'numeric',
      }),
    [diaSeleccionado, dateLocale],
  );

  const mostrarRecordatorioApto = useMemo(() => {
    const user = params.userData || {};
    if (!user || user.hasMedicalCertificate) return false;
    const creado = new Date(user.createdAt || new Date());
    const ahora = new Date();
    const diffDias = (ahora - creado) / (1000 * 60 * 60 * 24);
    return diffDias >= 15;
  }, [params.userData]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          alignItems: 'center',
          borderRadius: 24,
          marginBottom: 40,
          marginHorizontal: 16,
          marginTop: height * 0.18,
          padding: 24,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,   // unificado
          // sombras sutiles sobre overlay
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        },
        mes: {
          color: t.brand,
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 10,
          textAlign: 'center',
        },

        // alerta apto médico
        alertaApto: {
          backgroundColor: hexToRgba(t.brand, 0.08),
          borderLeftColor: hexToRgba(t.brand, 0.35),
          borderLeftWidth: 5,
          borderRadius: 8,
          marginBottom: 14,
          padding: 10,
          width: '100%',
        },
        textoAlerta: {
          color: t.text,
          fontSize: 13,
          fontWeight: '600',
        },

        // tira de días
        weekRow: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: 6,
          marginBottom: 24,
          paddingHorizontal: 10,
        },
        diaContainer: {
          alignItems: 'center',
          marginHorizontal: 4,
        },
        // sin color literal; la “selección” se marca con circuloActivo y diaLabelActivo
        diaSeleccionado: {},
        diaLabel: {
          color: t.subText,
          fontSize: 11,
          fontWeight: 'bold',
          marginBottom: 2,
          textAlign: 'center',
        },
        diaLabelActivo: {
          color: t.brand,
          fontWeight: 'bold',
        },
        circuloNumero: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder, // unificado
          borderRadius: 20,
          borderWidth: 1,
          height: 40,
          justifyContent: 'center',
          width: 40,
        },
        circuloActivo: {
          ...t.buttonPrimary,
        },
        diaNumero: {
          color: t.text,
          fontSize: 16,
          fontWeight: 'bold',
        },
        diaNumeroActivo: {
          ...t.buttonPrimaryText,
        },
        punto: {
          backgroundColor: t.brand,
          borderRadius: 3,
          height: 6,
          marginTop: 4,
          width: 6,
        },

        // horarios (cajas tipo input)
        subtitulo: {
          color: t.subText,
          fontSize: 18,
          fontWeight: '600',
          marginBottom: 14,
        },
        horariosContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
        },
        horario: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder, // unificado
          borderRadius: 12,
          borderWidth: 1.2,
          margin: 6,
          paddingHorizontal: 20,
          paddingVertical: 12,
        },
        horarioTexto: {
          color: t.text,
          fontWeight: 'bold',
        },

        // volver
        volver: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          marginTop: 30,
          padding: 14,
        },
        volverTxt: t.buttonPrimaryText,
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <View style={styles.panel}>
        <Text style={styles.mes}>{mes.toUpperCase()}</Text>

        {mostrarRecordatorioApto && (
          <View style={styles.alertaApto}>
            <Text style={styles.textoAlerta}>⚠️ {tStr('calendario_apto_reminder')}</Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekRow}
        >
          {days.map((d) => {
            const tieneContenido =
              plan?.bloquesDelDia?.[d.full]
              && Array.isArray(plan.bloquesDelDia[d.full])
              && plan.bloquesDelDia[d.full].length > 0;

            const seleccionado = diaSeleccionado === d.full;

            return (
              <TouchableOpacity
                key={d.full}
                onPress={() => setDiaSeleccionado(d.full)}
                style={[styles.diaContainer, seleccionado && styles.diaSeleccionado]}
              >
                <Text style={[styles.diaLabel, seleccionado && styles.diaLabelActivo]}>
                  {d.label.toUpperCase()}
                </Text>
                <View style={[styles.circuloNumero, seleccionado && styles.circuloActivo]}>
                  <Text style={[styles.diaNumero, seleccionado && styles.diaNumeroActivo]}>
                    {d.number}
                  </Text>
                </View>
                {tieneContenido && <View style={styles.punto} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.subtitulo}>{tStr('calendario_horarios_disponibles')}</Text>

        <View style={styles.horariosContainer}>
          {horarios.map((h) => (
            <TouchableOpacity key={h} style={styles.horario} onPress={() => handleReserva(h)}>
              <Text style={styles.horarioTexto}>{h}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.volver}>
          <Text style={styles.volverTxt}>⬅ {tStr('config_back')}</Text>
        </TouchableOpacity>
      </View>
    </BackgroundWrapper>
  );
}

CalendarioScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      userData: PropTypes.shape({
        hasMedicalCertificate: PropTypes.bool,
        createdAt: PropTypes.string,
      }),
    }),
  }),
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};
