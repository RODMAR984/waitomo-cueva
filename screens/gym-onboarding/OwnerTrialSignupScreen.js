// Alta owner con prueba gratis 14 días — reemplaza RegistroOwner + ConfiguraTuEspacio para landing /signup?trial=14d

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import ScreenShell from '../../components/ScreenShell';
import LogoCompleto from '../../components/LogoCompleto';
import LogoTriangleBackground from '../../components/LogoTriangleBackground';
import PasswordInput from '../../components/PasswordInput';
import WelcomeLocaleDropdown from '../../components/WelcomeLocaleDropdown';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { fitengineLogoColors as fe, fitengineUiTokens as fitT } from '../../theme/colors';
import { createWelcomeGlobalLayoutStyles } from '../../styles/welcomeGlobalLayoutStyles';
import { supabase } from '../../supabaseClient';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { AuthDismissKeyboardOutside, authScrollKeyboardDismissMode } from '../../components/AuthWebFormShell';
import { isTrialSignupQuery, parseWebTrialSignupFromWindow, TRIAL_SIGNUP_QUERY } from '../../utils/webAppLinking';
import { TRIAL_SIGNUP_COUNTRIES, localeDefaultsForCountry } from '../../utils/orgLocaleDefaults';
import { completeOwnerTrialSignup } from '../../services/signup/ownerTrialSignup';
import { sendAppWelcomeEmail } from '../../services/signup/appWelcomeEmail';

const FORM_MAX = 440;
const STEPS = 4;
const ACCENT_PALETTE = ['#86C4C7', '#6366f1', '#f59e0b', '#ec4899', '#22c55e', '#0ea5e9'];
const SIZE_RANGES = ['1-20', '21-50', '51-100', '101-200', '200+'];

function fmtTemplate(str, vars) {
  let s = String(str || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    s = s.split(`{{${k}}}`).join(String(v));
  });
  return s;
}

function resolveTrialParam(routeTrial) {
  if (isTrialSignupQuery(routeTrial)) return TRIAL_SIGNUP_QUERY;
  const fromWeb = parseWebTrialSignupFromWindow();
  if (fromWeb?.trial) return fromWeb.trial;
  return routeTrial;
}

export default function OwnerTrialSignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t, isDark } = useThemeContext();
  const { t: tStr, locale, setLocale } = useLocale();
  const { user, session, refreshProfile, refreshOrganization } = useAuth() || {};

  const trialParam = resolveTrialParam(route.params?.trial);
  const trialOk = isTrialSignupQuery(trialParam);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [businessModel, setBusinessModel] = useState('gym_presential');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('AR');
  const [sizeRange, setSizeRange] = useState('1-20');

  const [accentColor, setAccentColor] = useState('#86C4C7');
  const [activityType, setActivityType] = useState('');
  const [logoLocalUri, setLogoLocalUri] = useState(null);
  const [pickingLogo, setPickingLogo] = useState(false);

  useEffect(() => {
    const explicit = route.params?.trial;
    const hasExplicit = explicit != null && String(explicit).trim() !== '';
    if (hasExplicit && !isTrialSignupQuery(explicit)) {
      navigation.replace('WelcomeGlobal');
      return;
    }
    const web = parseWebTrialSignupFromWindow();
    if (web?.redirectWelcome) {
      navigation.replace('WelcomeGlobal');
    }
  }, [route.params?.trial, navigation]);

  const welcomeLayoutStyles = useMemo(
    () => createWelcomeGlobalLayoutStyles(fitT, fe, insets.top, { isWide: false }),
    [insets.top],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: fe.background },
        scroll: { flexGrow: 1, paddingBottom: insets.bottom + MOBILE_SPACING.xl },
        inner: {
          width: '100%',
          maxWidth: FORM_MAX,
          alignSelf: 'center',
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingTop: MOBILE_SPACING.md + insets.top,
        },
        localeRow: { alignSelf: 'flex-end', marginBottom: MOBILE_SPACING.sm },
        title: { color: fe.text, fontSize: MOBILE_TYPE.title, fontWeight: '800', textAlign: 'center' },
        subtitle: { color: fe.subText, fontSize: MOBILE_TYPE.body, textAlign: 'center', marginTop: 6, marginBottom: 20 },
        stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
        dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(134,196,199,0.25)' },
        dotActive: { backgroundColor: '#86C4C7' },
        input: {
          backgroundColor: fe.inputBg,
          borderColor: fe.inputBorder,
          borderWidth: 1,
          borderRadius: MOBILE_RADII.md,
          color: fe.text,
          padding: 12,
          marginBottom: 12,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        label: { color: fe.subText, fontSize: MOBILE_TYPE.caption, marginBottom: 6 },
        radioRow: {
          borderWidth: 1,
          borderColor: fe.inputBorder,
          borderRadius: MOBILE_RADII.md,
          padding: 12,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
        },
        radioRowOn: { borderColor: '#86C4C7', backgroundColor: 'rgba(134,196,199,0.08)' },
        radioText: { color: fe.text, flex: 1, marginLeft: 10, fontSize: MOBILE_TYPE.body },
        palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
        swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
        swatchOn: { borderColor: fe.text },
        termsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 10 },
        termsText: { color: fe.subText, flex: 1, fontSize: MOBILE_TYPE.caption },
        link: { color: '#86C4C7', textDecorationLine: 'underline' },
        btn: {
          backgroundColor: '#86C4C7',
          borderRadius: MOBILE_RADII.md,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: 8,
        },
        btnSecondary: {
          borderWidth: 1,
          borderColor: fe.inputBorder,
          borderRadius: MOBILE_RADII.md,
          paddingVertical: 12,
          alignItems: 'center',
          marginTop: 8,
        },
        btnText: { color: '#050a0d', fontWeight: '700', fontSize: MOBILE_TYPE.bodyStrong },
        btnTextSecondary: { color: fe.text, fontWeight: '600' },
        summary: {
          borderWidth: 1,
          borderColor: fe.inputBorder,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.md,
          marginBottom: 16,
          gap: 6,
        },
        summaryLine: { color: fe.text, fontSize: MOBILE_TYPE.body },
        backLink: { alignSelf: 'center', marginTop: MOBILE_SPACING.lg, padding: 8 },
        backLinkText: { color: fe.subText, fontSize: MOBILE_TYPE.body },
      }),
    [insets.top, insets.bottom],
  );

  const hasSession = !!(session?.user?.id || user?.id);

  const validateStep1 = () => {
    const n = fullName.trim();
    const e = email.trim().toLowerCase();
    if (!n || !e || !password) {
      Alert.alert(tStr('trial_alert_missing_title'), tStr('trial_alert_missing_body'));
      return false;
    }
    if (password.length < 6) {
      Alert.alert(tStr('registro_owner_pass_corta'), tStr('registro_owner_pass_min_body'));
      return false;
    }
    if (password !== password2) {
      Alert.alert(tStr('trial_alert_pass_mismatch_title'), tStr('trial_alert_pass_mismatch_body'));
      return false;
    }
    if (!acceptTerms) {
      Alert.alert(tStr('trial_alert_terms_title'), tStr('trial_alert_terms_body'));
      return false;
    }
    return true;
  };

  const handleStep1Next = async () => {
    if (!validateStep1()) return;
    if (hasSession) {
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      const e = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'coach',
            signup_intent: 'gym_owner_trial',
          },
        },
      });
      if (error) throw error;
      if (!data?.user) throw new Error(tStr('registro_owner_error_no_user'));
      if (!data.session) {
        setAwaitingEmailConfirm(true);
        Alert.alert(tStr('signup_email_confirm_title'), tStr('signup_email_confirm_body'));
        return;
      }
      setStep(2);
    } catch (err) {
      Alert.alert(tStr('gym_config_alert_title_error'), err?.message || tStr('registro_owner_error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const validateStep2 = () => {
    if (!orgName.trim()) {
      Alert.alert(tStr('fe_alert_name_title'), tStr('fe_alert_name_body'));
      return false;
    }
    if (!city.trim()) {
      Alert.alert(tStr('trial_alert_city_title'), tStr('trial_alert_city_body'));
      return false;
    }
    return true;
  };

  const pickLogo = async () => {
    try {
      setPickingLogo(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(tStr('fe_alert_perm_gallery_logo_title'), tStr('fe_alert_perm_gallery_logo_body'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });
      if (!result.canceled && result.assets?.[0]?.uri) setLogoLocalUri(result.assets[0].uri);
    } catch (e) {
      Alert.alert(tStr('fe_alert_logo_pick_fail_title'), e?.message || tStr('fe_alert_pick_image_fail'));
    } finally {
      setPickingLogo(false);
    }
  };

  const handleCreate = async () => {
    if (!hasSession) {
      Alert.alert(tStr('fe_alert_session_title'), tStr('trial_alert_confirm_email_first'));
      return;
    }
    setLoading(true);
    try {
      const locale = localeDefaultsForCountry(country);
      const result = await completeOwnerTrialSignup({
        orgName: orgName.trim(),
        businessModel,
        country: country === 'OTHER' ? '' : country,
        city: city.trim(),
        sizeRange,
        accentColor,
        activityType: activityType.trim() || null,
        billingCurrency: locale.currency,
        timezone: locale.timezone,
        logoLocalUri,
      });
      await Promise.all([
        typeof refreshProfile === 'function' ? refreshProfile() : Promise.resolve(),
        typeof refreshOrganization === 'function'
          ? refreshOrganization(result.organizationId)
          : Promise.resolve(),
      ]);
      void sendAppWelcomeEmail('owner_trial', { organizationId: result.organizationId });
      const go = () => navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
      if (result.storageSkipped) {
        Alert.alert(tStr('fe_alert_space_created_title'), tStr('fe_alert_space_created_body'), [
          { text: tStr('fe_alert_understood'), onPress: go },
        ]);
      } else {
        go();
      }
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('already_owner')) {
        Alert.alert(tStr('trial_alert_already_owner_title'), tStr('trial_alert_already_owner_body'), [
          { text: tStr('common_ok'), onPress: () => navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] }) },
        ]);
        return;
      }
      Alert.alert(tStr('gym_config_alert_title_error'), msg || tStr('fe_alert_create_fail'));
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
  <>
    <Text style={styles.label}>{tStr('trial_field_name')}</Text>
    <TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
    <Text style={styles.label}>{tStr('trial_field_email')}</Text>
    <TextInput
      style={styles.input}
      value={email}
      onChangeText={setEmail}
      keyboardType="email-address"
      autoCapitalize="none"
      editable={!hasSession}
    />
    <Text style={styles.label}>{tStr('trial_field_password')}</Text>
    <PasswordInput value={password} onChangeText={setPassword} placeholder="" />
    <Text style={styles.label}>{tStr('trial_field_password_confirm')}</Text>
    <PasswordInput value={password2} onChangeText={setPassword2} placeholder="" />
    <View style={styles.termsRow}>
      <Switch value={acceptTerms} onValueChange={setAcceptTerms} trackColor={{ true: '#86C4C7' }} />
      <Text style={styles.termsText}>
        {tStr('trial_terms_prefix')}{' '}
        <Text style={styles.link} onPress={() => navigation.navigate('TermsOfUse')}>
          {tStr('welcome_footer_terms')}
        </Text>{' '}
        {tStr('trial_terms_and')}{' '}
        <Text style={styles.link} onPress={() => navigation.navigate('PrivacyPolicy')}>
          {tStr('welcome_footer_privacy')}
        </Text>
      </Text>
    </View>
    {awaitingEmailConfirm ? (
      <Text style={[styles.subtitle, { marginTop: 12 }]}>{tStr('trial_check_email_hint')}</Text>
    ) : null}
    <TouchableOpacity style={styles.btn} onPress={handleStep1Next} disabled={loading}>
      {loading ? <ActivityIndicator color="#050a0d" /> : <Text style={styles.btnText}>{tStr('trial_btn_continue')}</Text>}
    </TouchableOpacity>
  </>
  );

  const renderBusinessOption = (value, labelKey) => (
    <TouchableOpacity
      key={value}
      style={[styles.radioRow, businessModel === value && styles.radioRowOn]}
      onPress={() => setBusinessModel(value)}
    >
      <Ionicons
        name={businessModel === value ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={businessModel === value ? '#86C4C7' : fe.subText}
      />
      <Text style={styles.radioText}>{tStr(labelKey)}</Text>
    </TouchableOpacity>
  );

  const renderStep2 = () => (
  <>
    <Text style={styles.label}>{tStr('trial_field_gym_name')}</Text>
    <TextInput style={styles.input} value={orgName} onChangeText={setOrgName} />
    <Text style={styles.label}>{tStr('trial_field_business_model')}</Text>
    {renderBusinessOption('gym_presential', 'trial_model_gym_presential')}
    {renderBusinessOption('coach_online', 'trial_model_coach_online')}
    {renderBusinessOption('combined', 'trial_model_combined')}
    <Text style={styles.label}>{tStr('trial_field_city')}</Text>
    <TextInput style={styles.input} value={city} onChangeText={setCity} />
    <Text style={styles.label}>{tStr('trial_field_country')}</Text>
    {TRIAL_SIGNUP_COUNTRIES.map((c) => (
      <TouchableOpacity
        key={c.code}
        style={[styles.radioRow, country === c.code && styles.radioRowOn]}
        onPress={() => setCountry(c.code)}
      >
        <Ionicons
          name={country === c.code ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={country === c.code ? '#86C4C7' : fe.subText}
        />
        <Text style={styles.radioText}>{tStr(c.labelKey)}</Text>
      </TouchableOpacity>
    ))}
    <Text style={styles.label}>{tStr('trial_field_size')}</Text>
    {SIZE_RANGES.map((sr) => (
      <TouchableOpacity
        key={sr}
        style={[styles.radioRow, sizeRange === sr && styles.radioRowOn]}
        onPress={() => setSizeRange(sr)}
      >
        <Ionicons
          name={sizeRange === sr ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={sizeRange === sr ? '#86C4C7' : fe.subText}
        />
        <Text style={styles.radioText}>{sr}</Text>
      </TouchableOpacity>
    ))}
    <TouchableOpacity style={styles.btn} onPress={() => validateStep2() && setStep(3)}>
      <Text style={styles.btnText}>{tStr('trial_btn_continue')}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}>
      <Text style={styles.btnTextSecondary}>{tStr('common_back')}</Text>
    </TouchableOpacity>
  </>
  );

  const renderStep3 = () => (
  <>
    <Text style={styles.label}>{tStr('trial_field_logo')}</Text>
    <TouchableOpacity style={styles.btnSecondary} onPress={pickLogo} disabled={pickingLogo}>
      <Text style={styles.btnTextSecondary}>
        {logoLocalUri ? tStr('trial_logo_change') : tStr('trial_logo_pick')}
      </Text>
    </TouchableOpacity>
    <Text style={[styles.label, { marginTop: 16 }]}>{tStr('trial_field_accent')}</Text>
    <View style={styles.palette}>
      {ACCENT_PALETTE.map((c) => (
        <TouchableOpacity
          key={c}
          onPress={() => setAccentColor(c)}
          style={[styles.swatch, { backgroundColor: c }, accentColor === c && styles.swatchOn]}
        />
      ))}
    </View>
    <Text style={styles.label}>{tStr('trial_field_activity')}</Text>
    <TextInput
      style={styles.input}
      value={activityType}
      onChangeText={setActivityType}
      placeholder={tStr('trial_field_activity_ph')}
      placeholderTextColor={fe.subText}
    />
    <TouchableOpacity style={styles.btn} onPress={() => setStep(4)}>
      <Text style={styles.btnText}>{tStr('trial_btn_continue')}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(2)}>
      <Text style={styles.btnTextSecondary}>{tStr('common_back')}</Text>
    </TouchableOpacity>
  </>
  );

  const renderStep4 = () => (
  <>
    <View style={styles.summary}>
      <Text style={styles.summaryLine}>{fmtTemplate(tStr('trial_summary_name'), { name: fullName.trim() })}</Text>
      <Text style={styles.summaryLine}>{fmtTemplate(tStr('trial_summary_email'), { email: email.trim() })}</Text>
      <Text style={styles.summaryLine}>{fmtTemplate(tStr('trial_summary_gym'), { gym: orgName.trim() })}</Text>
      <Text style={styles.summaryLine}>{fmtTemplate(tStr('trial_summary_country'), { country: tStr(TRIAL_SIGNUP_COUNTRIES.find((c) => c.code === country)?.labelKey || 'trial_country_other') })}</Text>
      <Text style={styles.summaryLine}>{tStr('trial_summary_trial_note')}</Text>
    </View>
    <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={loading}>
      {loading ? (
        <ActivityIndicator color="#050a0d" />
      ) : (
        <Text style={styles.btnText}>{tStr('trial_btn_create')}</Text>
      )}
    </TouchableOpacity>
    <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(3)} disabled={loading}>
      <Text style={styles.btnTextSecondary}>{tStr('common_back')}</Text>
    </TouchableOpacity>
  </>
  );

  if (!trialOk) return null;

  return (
    <ScreenShell
      screen="neutral"
      scroll
      keyboardAvoid="form"
      keyboardAvoidProps={{ style: { flex: 1 } }}
      scrollProps={{
        keyboardDismissMode: authScrollKeyboardDismissMode,
        contentContainerStyle: styles.scroll,
      }}
    >
      <SafeAreaView style={styles.safe} edges={[]}>
        <LogoTriangleBackground
          isDark={isDark}
          variant="registro"
          blendMode="lighten"
          sizeScale={2.4}
          opacityOverride={isDark ? 0.35 : 0.22}
          offsetY={-24}
        />
        <AuthDismissKeyboardOutside>
          <View style={styles.inner}>
            <View style={styles.localeRow}>
              <WelcomeLocaleDropdown
                locale={locale}
                setLocale={setLocale}
                layoutStyles={welcomeLayoutStyles}
                fitT={fitT}
              />
            </View>
            <LogoCompleto height={56} />
            <Text style={styles.title}>{tStr('trial_signup_title')}</Text>
            <Text style={styles.subtitle}>{tStr('trial_signup_subtitle')}</Text>
            <View style={styles.stepDots}>
              {Array.from({ length: STEPS }, (_, i) => (
                <View key={i} style={[styles.dot, step === i + 1 && styles.dotActive]} />
              ))}
            </View>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('WelcomeGlobal')}>
              <Text style={styles.backLinkText}>{tStr('trial_back_welcome')}</Text>
            </TouchableOpacity>
          </View>
        </AuthDismissKeyboardOutside>
      </SafeAreaView>
    </ScreenShell>
  );
}
