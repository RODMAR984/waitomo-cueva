import { Platform, StyleSheet } from 'react-native';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';

/** Estética compartida: WelcomeGlobal + WelcomeDualChoice (logo, CTAs, locale). */
export function createWelcomeGlobalLayoutStyles(t, fe, topInset = 0, layout = {}) {
  const safeTop = typeof topInset === 'number' ? topInset : 0;
  const isWide = !!layout?.isWide;
  /** Web: tarjeta centrada (no banda horizontal); nativo ancho amplio solo si !web. */
  const isWeb = Platform.OS === 'web';
  const contentMaxWidth = isWeb ? Math.min(WEB_CONTENT_MAX_WIDTH, 440) : isWide ? 720 : 420;
  const ctaMaxWidth = isWeb ? 400 : isWide ? 360 : 280;
  const subtitleMaxWidth = isWeb ? 400 : isWide ? 620 : 320;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    topBar: {
      position: 'absolute',
      top: 10 + safeTop,
      right: 18,
      zIndex: 20,
    },
    localeGroup: {
      flexDirection: 'row',
      borderRadius: WEB_PANEL_RADIUS,
      borderWidth: 1,
      borderColor: t.overlayBorder,
      overflow: 'hidden',
      backgroundColor: t.inputBg,
    },
    localeBtn: {
      minHeight: MOBILE_SIZES.localeControlHeight,
      paddingVertical: MOBILE_SPACING.xs,
      paddingHorizontal: 10,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    localeBtnActive: {
      backgroundColor: fe.buttonBg,
    },
    localeDivider: {
      width: 1,
      backgroundColor: t.overlayBorder,
    },
    localeText: {
      color: t.subText,
      fontSize: MOBILE_TYPE.caption,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    localeTextActive: {
      color: fe.buttonText,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      width: '100%',
      alignSelf: 'center',
      maxWidth: contentMaxWidth,
    },
    logoWrap: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 34,
    },
    subtitle: {
      color: t.subText,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: MOBILE_SPACING.lg,
      maxWidth: subtitleMaxWidth,
    },
    ctaWrap: {
      alignItems: 'center',
      gap: MOBILE_SPACING.sm,
      width: '100%',
      maxWidth: ctaMaxWidth,
    },
    joinHub: {
      width: '100%',
      borderRadius: WEB_PANEL_RADIUS,
      borderWidth: 1,
      borderColor: t.overlayBorder,
      backgroundColor: t.inputBg,
      paddingVertical: MOBILE_SPACING.md,
      paddingHorizontal: MOBILE_SPACING.md,
      marginBottom: MOBILE_SPACING.sm,
      gap: MOBILE_SPACING.xs,
    },
    joinHubTitle: {
      color: t.subText,
      fontSize: MOBILE_TYPE.bodyStrong,
      fontWeight: '800',
      textAlign: 'center',
    },
    joinHubHint: {
      color: t.subText,
      fontSize: 12,
      textAlign: 'center',
      opacity: 0.9,
      marginBottom: MOBILE_SPACING.xs,
    },
    joinSubRow: {
      flexDirection: isWide ? 'row' : 'column',
      gap: MOBILE_SPACING.sm,
      width: '100%',
    },
    joinSubBtnStack: {
      width: '100%',
    },
    joinSubBtnWide: {
      flex: 1,
      minWidth: 0,
    },
    ctaPrimary: {
      backgroundColor: fe.buttonBg,
      borderColor: fe.buttonBorder,
      borderWidth: 1,
      borderRadius: WEB_PANEL_RADIUS,
      minHeight: MOBILE_SIZES.controlHeightLg,
      paddingVertical: MOBILE_SPACING.md,
      paddingHorizontal: MOBILE_SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    ctaSecondary: {
      backgroundColor: fe.buttonBg,
      borderColor: fe.buttonBorder,
      borderWidth: 1,
      borderRadius: WEB_PANEL_RADIUS,
      minHeight: MOBILE_SIZES.controlHeightLg,
      paddingVertical: MOBILE_SPACING.md,
      paddingHorizontal: MOBILE_SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    ctaPrimaryText: {
      color: fe.buttonText,
      fontSize: MOBILE_TYPE.bodyStrong,
      fontWeight: 'bold',
    },
    ctaSecondaryText: {
      color: fe.buttonText,
      fontSize: MOBILE_TYPE.bodyStrong,
      fontWeight: 'bold',
    },
    linkRow: {
      marginTop: 6,
      paddingVertical: 6,
    },
    linkText: {
      color: t.subText,
      fontSize: 13,
      textAlign: 'center',
      textDecorationLine: 'underline',
    },
    dualHint: {
      color: t.subText,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 6,
      paddingHorizontal: 8,
    },
    sessionEmail: {
      color: t.subText,
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 12,
      opacity: 0.9,
    },
    sessionActionsRow: {
      width: '100%',
      gap: 8,
    },
    loadingBox: {
      width: '100%',
      alignItems: 'center',
      gap: 12,
    },
  });
}
