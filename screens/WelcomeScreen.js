// WelcomeScreen — fondo mano + kettlebell; texto Waitomo Training incrustado = ingreso principal;
// otros 3 ingresos = objetos (disco bumper, magnesio, pizarra)
import React, { useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { getThemeTokens } from '../theme/colors';
import BackgroundWrapper from '../components/BackgroundWrapper';


const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full =
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, role, profile } = useAuth();
  const { t: tStr } = useLocale();
  const t = useMemo(() => getThemeTokens('dark'), []);

  const bottomInset = Math.max(insets.bottom || 0, Platform.OS === 'android' ? 28 : 0);
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fullScreen: { flex: 1 },
        // Texto centrado sobre la kettlebell (bajado para quedar en el centro de la bola)
        heroTouchable: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        },
        heroTextBlock: {
          marginTop: 72,
        },
        titleTop: {
          color: t.brand,
          fontSize: 36,
          fontWeight: '800',
          letterSpacing: 6,
          textAlign: 'center',
          textShadowColor: hexToRgba(t.brand, 0.5),
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 14,
        },
        titleBottom: {
          color: t.brand,
          fontSize: 28,
          fontWeight: '800',
          letterSpacing: 8,
          marginTop: 6,
          textAlign: 'center',
          textShadowColor: hexToRgba(t.brand, 0.45),
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 12,
        },
        subtitle: {
          color: t.subText,
          fontSize: 18,
          fontWeight: '600',
          marginTop: 10,
          letterSpacing: 2,
          textAlign: 'center',
        },
        // Tres ingresos como “objetos” en la imagen: disco bumper, magnesio, pizarra
        objectsRow: {
          position: 'absolute',
          bottom: bottomInset + 20,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          paddingHorizontal: 16,
        },
        objectButton: {
          alignItems: 'center',
          justifyContent: 'center',
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: hexToRgba(t.brand, 0.25),
          borderWidth: 1.5,
          borderColor: hexToRgba(t.brand, 0.5),
        },
        objectIcon: { marginBottom: 4 },
        objectLabel: {
          color: t.subText,
          fontSize: 10,
          fontWeight: '600',
          textAlign: 'center',
        },
      }),
    [t, bottomInset],
  );

  const handlePressHero = () => {
    if (user) {
      if (!profile) {
        navigation.navigate('RegistroInicial', { plan: null, abono: null });
        return;
      }
      if (role === 'superadmin') {
        navigation.navigate('Admin');
      } else if (role === 'coach') {
        navigation.navigate('AdminLite');
      } else {
        navigation.navigate('ClientTabs');
      }
      return;
    }
    navigation.navigate('PlanSelector');
  };

  return (
    <BackgroundWrapper screen="Welcome" forceDarkOverlay>
      <View style={styles.fullScreen}>
        {/* Ingreso principal: tocar el texto incrustado en la imagen */}
        <TouchableOpacity
          onPress={handlePressHero}
          activeOpacity={0.85}
          style={styles.heroTouchable}
        >
          <Animated.View style={[styles.heroTextBlock, { opacity: opacityAnim }]}>
            <Text style={styles.titleTop}>WAITOMO</Text>
            <Text style={styles.titleBottom}>TRAINING</Text>
            <Text style={styles.subtitle}>{tStr('welcome_subtitle')}</Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Objetos: disco bumper = cliente, magnesio = staff, pizarra = admin */}
        <View style={styles.objectsRow}>
          <TouchableOpacity
            style={styles.objectButton}
            onPress={() => navigation.navigate('Login', { forStaff: false })}
            activeOpacity={0.8}
          >
            <Ionicons name="disc" size={28} color={t.brand} style={styles.objectIcon} />
            <Text style={styles.objectLabel}>{tStr('welcome_client')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.objectButton}
            onPress={() => navigation.navigate('Login', { forStaff: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="brush" size={28} color={t.brand} style={styles.objectIcon} />
            <Text style={styles.objectLabel}>{tStr('welcome_staff')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.objectButton}
            onPress={() => navigation.navigate('AdminLogin')}
            activeOpacity={0.8}
          >
            <Ionicons name="school" size={28} color={t.brand} style={styles.objectIcon} />
            <Text style={styles.objectLabel}>{tStr('welcome_admin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BackgroundWrapper>
  );
}
