import { StyleSheet } from 'react-native';

/** Estética compartida: WelcomeGlobal + WelcomeDualChoice (logo, CTAs, locale). */
export function createWelcomeGlobalLayoutStyles(t, fe) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    topBar: {
      position: 'absolute',
      top: 18,
      right: 18,
      zIndex: 20,
    },
    localeGroup: {
      flexDirection: 'row',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.overlayBorder,
      overflow: 'hidden',
      backgroundColor: t.inputBg,
    },
    localeBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      minWidth: 44,
      alignItems: 'center',
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
      fontSize: 12,
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
    },
    logoWrap: {
      alignItems: 'center',
      marginBottom: 34,
    },
    subtitle: {
      color: t.subText,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 16,
      maxWidth: 320,
    },
    ctaWrap: {
      alignItems: 'center',
      gap: 8,
      width: '100%',
      maxWidth: 280,
    },
    ctaPrimary: {
      backgroundColor: fe.buttonBg,
      borderColor: fe.buttonBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      width: '100%',
    },
    ctaSecondary: {
      backgroundColor: fe.buttonBg,
      borderColor: fe.buttonBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      width: '100%',
    },
    ctaPrimaryText: {
      color: fe.buttonText,
      fontSize: 15,
      fontWeight: 'bold',
    },
    ctaSecondaryText: {
      color: fe.buttonText,
      fontSize: 15,
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
      alignItems: 'center',
      gap: 12,
    },
  });
}
