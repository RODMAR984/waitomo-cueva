import { Platform, StyleSheet } from 'react-native';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH } from '../theme/webSpec';

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
    localeDropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: MOBILE_RADII.lg,
      borderWidth: 1,
      borderColor: t.overlayBorder,
      backgroundColor: t.inputBg,
      paddingVertical: MOBILE_SPACING.xs,
      paddingHorizontal: 12,
      minHeight: MOBILE_SIZES.localeControlHeight,
      minWidth: 76,
    },
    localeDropdownTriggerText: {
      color: t.text,
      fontSize: MOBILE_TYPE.caption,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    /** Fondo tocable para cerrar el popover de idioma (sin centrar menú). */
    localePopoverBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    /** Caja del menú: tamaño discreto; posición top/left la fija WelcomeLocaleDropdown. */
    localePopoverMenu: {
      borderRadius: MOBILE_RADII.md,
      borderWidth: 1,
      borderColor: t.overlayBorder,
      backgroundColor: t.inputBg,
      overflow: 'hidden',
      ...Platform.select({
        web: { boxShadow: '0 4px 14px rgba(0,0,0,0.35)' },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.28,
          shadowRadius: 5,
        },
        android: { elevation: 8 },
        default: {},
      }),
    },
    localePopoverOption: {
      paddingVertical: 10,
      paddingHorizontal: MOBILE_SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.overlayBorder,
    },
    localePopoverOptionLast: {
      borderBottomWidth: 0,
    },
    localePopoverOptionActive: {
      backgroundColor: fe.buttonBg,
    },
    localePopoverOptionText: {
      fontSize: MOBILE_TYPE.caption,
      color: t.text,
      fontWeight: '600',
    },
    localePopoverOptionTextActive: {
      color: fe.buttonText,
      fontWeight: '800',
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
      fontSize: MOBILE_TYPE.body,
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
      borderRadius: MOBILE_RADII.lg,
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
      fontSize: MOBILE_TYPE.caption,
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
      borderRadius: MOBILE_RADII.lg,
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
      borderRadius: MOBILE_RADII.lg,
      minHeight: MOBILE_SIZES.controlHeightLg,
      paddingVertical: MOBILE_SPACING.md,
      paddingHorizontal: MOBILE_SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    /** Botón secundario outline (gym/coach en welcome). */
    ctaSecondaryOutline: {
      backgroundColor: 'transparent',
      borderColor: t.overlayBorder,
      borderWidth: 1,
      borderRadius: MOBILE_RADII.lg,
      minHeight: MOBILE_SIZES.controlHeightLg,
      paddingVertical: MOBILE_SPACING.md,
      paddingHorizontal: MOBILE_SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    ctaSecondaryOutlineText: {
      color: t.text,
      fontSize: MOBILE_TYPE.bodyStrong,
      fontWeight: '700',
    },
    /** Outline con borde cian (misma familia que CTA primario). */
    ctaSecondaryOutlineBrand: {
      backgroundColor: 'transparent',
      borderColor: fe.buttonBg,
      borderWidth: 1,
      borderRadius: MOBILE_RADII.lg,
      minHeight: MOBILE_SIZES.controlHeightLg,
      paddingVertical: MOBILE_SPACING.md,
      paddingHorizontal: MOBILE_SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    ctaSecondaryOutlineBrandText: {
      color: t.logoCian,
      fontSize: MOBILE_TYPE.bodyStrong,
      fontWeight: '700',
    },
    brandTitle: {
      color: t.text,
      fontSize: MOBILE_TYPE.title + 6,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    brandByline: {
      color: t.subText,
      fontSize: MOBILE_TYPE.body,
      textAlign: 'center',
      marginTop: 4,
      opacity: 0.95,
    },
    brandTagline: {
      color: t.subText,
      fontSize: MOBILE_TYPE.bodyStrong,
      textAlign: 'center',
      marginTop: MOBILE_SPACING.sm,
      marginBottom: MOBILE_SPACING.lg,
      maxWidth: subtitleMaxWidth,
    },
    loginPromptRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: MOBILE_SPACING.lg,
      paddingHorizontal: MOBILE_SPACING.sm,
    },
    loginPromptMuted: {
      color: t.subText,
      fontSize: MOBILE_TYPE.body,
    },
    loginPromptAction: {
      color: t.logoCian,
      fontSize: MOBILE_TYPE.bodyStrong,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    brandPoweredWelcome: {
      color: t.subText,
      fontSize: MOBILE_TYPE.caption,
      textAlign: 'center',
      marginTop: MOBILE_SPACING.xs,
      opacity: 0.9,
    },
    brandWordmark: {
      color: t.text,
      fontSize: MOBILE_TYPE.title,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: MOBILE_SPACING.sm,
    },
    /** Volver: mismo lenguaje que outline de código/buscar, más chico. */
    ctaBackCompact: {
      backgroundColor: 'transparent',
      borderColor: t.overlayBorder,
      borderWidth: 1,
      borderRadius: MOBILE_RADII.lg,
      minHeight: MOBILE_SIZES.controlHeight,
      paddingVertical: MOBILE_SPACING.sm,
      paddingHorizontal: MOBILE_SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      maxWidth: 200,
      width: '100%',
      flexDirection: 'row',
    },
    ctaBackCompactText: {
      color: t.text,
      fontSize: MOBILE_TYPE.body,
      fontWeight: '700',
    },
    footerLegalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: MOBILE_SPACING.xl,
      gap: 8,
      paddingBottom: MOBILE_SPACING.lg,
    },
    footerLegalText: {
      color: t.subText,
      fontSize: MOBILE_TYPE.caption,
      fontWeight: '600',
    },
    footerLegalDot: {
      color: t.subText,
      fontSize: MOBILE_TYPE.caption,
      opacity: 0.6,
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
      fontSize: MOBILE_TYPE.bodyStrong,
      textAlign: 'center',
      textDecorationLine: 'underline',
    },
    dualHint: {
      color: t.subText,
      fontSize: MOBILE_TYPE.bodyStrong,
      textAlign: 'center',
      marginBottom: 6,
      paddingHorizontal: 8,
    },
    sessionEmail: {
      color: t.subText,
      fontSize: MOBILE_TYPE.caption,
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
