// Segundo nivel: cliente elige código o directorio. Mismo ancho y ritmo que WelcomeGlobal.

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../contexts/LocaleContext';
import LogoCompleto from '../../components/LogoCompleto';
import { fitengineLogoColors as fe, fitengineUiTokens as fitT } from '../../theme/colors';
import { createWelcomeGlobalLayoutStyles } from '../../styles/welcomeGlobalLayoutStyles';
import { WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { MOBILE_SPACING } from '../../theme/mobileSpec';

export default function WelcomeClientJoinScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t: tStr } = useLocale();
  const isWideWeb = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const layoutStyles = useMemo(
    () => createWelcomeGlobalLayoutStyles(fitT, fe, insets.top, { isWide: isWideWeb }),
    [insets.top, isWideWeb],
  );

  return (
    <View style={[layoutStyles.container, { paddingBottom: Math.max(insets.bottom, MOBILE_SPACING.md) }]}>
      <View style={[layoutStyles.content, { flex: 1, justifyContent: 'space-between', minHeight: 0 }]} collapsable={false}>
        <View
          style={{
            flex: 1,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 0,
          }}
        >
          <View style={[layoutStyles.logoWrap, { marginBottom: MOBILE_SPACING.md }]}>
            <LogoCompleto height={72} />
          </View>
          <Text style={[layoutStyles.subtitle, { fontWeight: '800', color: fitT.text, marginBottom: 6 }]}>
            {tStr('welcome_client_join_title')}
          </Text>
          <Text style={[layoutStyles.subtitle, { marginBottom: MOBILE_SPACING.lg }]}>
            {tStr('welcome_client_join_hint')}
          </Text>
          <View style={layoutStyles.ctaWrap}>
            <TouchableOpacity
              style={layoutStyles.ctaPrimary}
              onPress={() => navigation.navigate('JoinWithInvite')}
              activeOpacity={0.85}
              testID="welcome-client-join-code"
            >
              <Text style={layoutStyles.ctaPrimaryText}>{tStr('welcome_client_join_code')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={layoutStyles.ctaSecondaryOutline}
              onPress={() => navigation.navigate('PublicDirectory')}
              activeOpacity={0.85}
              testID="welcome-client-join-directory"
            >
              <Text style={layoutStyles.ctaSecondaryOutlineText}>{tStr('welcome_client_join_directory')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[layoutStyles.ctaBackCompact, { alignSelf: 'center', marginTop: MOBILE_SPACING.lg }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          testID="welcome-client-join-back"
        >
          <Ionicons name="chevron-back" size={18} color={fitT.text} />
          <Text style={[layoutStyles.ctaBackCompactText, { marginLeft: 6 }]}>{tStr('common_back')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
