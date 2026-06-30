import React from 'react';
import { ScrollView, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import BackgroundWrapper from './BackgroundWrapper';
import ScreenRoot from './ScreenRoot';
import { FormKeyboardAvoidingView } from './AuthWebFormShell';
import useUiSurface from '../hooks/useUiSurface';
import { SCREEN_FILL, scrollContentContainer } from '../utils/screenLayout';

/**
 * Única API pública de pantalla con fondo FitEngine.
 * Encapsula: BackgroundWrapper (solo imagen/velo) + ScreenRoot (flex) + scroll/list opcional por superficie.
 */
export default function ScreenShell({
  children,
  screen = '',
  plan = null,
  fondo = null,
  seed,
  forceDarkOverlay = false,
  style,
  imageStyle,
  rootStyle,
  scroll = false,
  scrollProps = {},
  list = false,
  listProps = {},
  /** false | 'default' (KAV nativo) | 'form' (FormKeyboardAvoidingView, sin KAV en web) */
  keyboardAvoid = false,
  keyboardAvoidProps = {},
  /** Hermanos dentro del contenedor flex (p. ej. modales) — van dentro del KAV si hay keyboardAvoid */
  companion = null,
  testID,
  planKey: _planKey,
}) {
  const { surface } = useUiSurface();

  let body;

  if (list) {
    const { style: listStyle, contentContainerStyle, testID: listTestID, ...restList } = listProps;
    body = (
      <FlatList
        testID={listTestID || testID}
        style={[SCREEN_FILL, listStyle]}
        contentContainerStyle={scrollContentContainer(surface, contentContainerStyle)}
        keyboardShouldPersistTaps="handled"
        {...restList}
      />
    );
  } else if (scroll) {
    const { style: scrollStyle, contentContainerStyle, testID: scrollTestID, ...restScroll } = scrollProps;
    body = (
      <ScrollView
        testID={scrollTestID || testID}
        style={[SCREEN_FILL, scrollStyle]}
        contentContainerStyle={scrollContentContainer(surface, contentContainerStyle)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...restScroll}
      >
        {children}
      </ScrollView>
    );
  } else {
    body = children;
  }

  if (companion) {
    body = (
      <>
        {body}
        {companion}
      </>
    );
  }

  if (keyboardAvoid === 'form') {
    body = <FormKeyboardAvoidingView {...keyboardAvoidProps}>{body}</FormKeyboardAvoidingView>;
  } else if (keyboardAvoid === 'default') {
    const {
      style: kavStyle,
      behavior,
      keyboardVerticalOffset,
      ...kavRest
    } = keyboardAvoidProps;
    body = (
      <KeyboardAvoidingView
        style={[SCREEN_FILL, kavStyle]}
        behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : undefined)}
        keyboardVerticalOffset={
          keyboardVerticalOffset ?? (Platform.OS === 'ios' ? 80 : 0)
        }
        {...kavRest}
      >
        {body}
      </KeyboardAvoidingView>
    );
  }

  return (
    <BackgroundWrapper
      screen={screen}
      plan={plan}
      fondo={fondo}
      seed={seed}
      style={style}
      imageStyle={imageStyle}
      forceDarkOverlay={forceDarkOverlay}
    >
      <ScreenRoot style={rootStyle} testID={testID && !scroll && !list ? testID : undefined}>
        {body}
      </ScreenRoot>
    </BackgroundWrapper>
  );
}
